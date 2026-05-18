import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import process from 'node:process'
import { Buffer } from 'node:buffer'
import { randomBytes } from 'node:crypto'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  let notionAccessToken = env.NOTION_API_KEY || env.VITE_NOTION_API_KEY || ''
  let notionWorkspace = ''
  let oauthState = ''
  let connectionMode = notionAccessToken ? 'api_key' : '' // 'api_key' | 'oauth' | ''

  return {
    plugins: [
      react(),
      {
        name: 'wikimind-notion-oauth',
        configureServer(server) {
          // ── Status endpoint ──────────────────────────────────────────────
          server.middlewares.use('/notion-oauth/status', async (_req, res) => {
            const oauthConfigured = Boolean(env.NOTION_CLIENT_ID && env.NOTION_CLIENT_SECRET)
            const apiKeyConfigured = Boolean(env.NOTION_API_KEY || env.VITE_NOTION_API_KEY)
            let connected = false
            let workspace = ''
            let botName = ''

            if (notionAccessToken) {
              try {
                const info = await getNotionUserInfo(notionAccessToken, env)
                if (info) {
                  connected = true
                  workspace = notionWorkspace || info.workspace || ''
                  botName = info.botName || ''
                  if (!notionWorkspace && workspace) notionWorkspace = workspace
                }
              } catch {
                connected = false
              }
            }

            sendJson(res, {
              configured: oauthConfigured || apiKeyConfigured,
              oauthConfigured,
              apiKeyConfigured,
              connected,
              connectionMode: connected ? connectionMode : '',
              workspace,
              botName,
            })
          })

          // ── Start OAuth flow ─────────────────────────────────────────────
          server.middlewares.use('/notion-oauth/start', (_req, res) => {
            if (!env.NOTION_CLIENT_ID || !env.NOTION_CLIENT_SECRET) {
              sendJson(res, {
                error: 'Add NOTION_CLIENT_ID and NOTION_CLIENT_SECRET to .env, then restart npm run dev.',
              }, 400)
              return
            }

            oauthState = randomBytes(16).toString('hex')
            const redirectUri = getNotionRedirectUri(env)
            const authorizeUrl = new URL('https://api.notion.com/v1/oauth/authorize')
            authorizeUrl.searchParams.set('client_id', env.NOTION_CLIENT_ID)
            authorizeUrl.searchParams.set('response_type', 'code')
            authorizeUrl.searchParams.set('owner', 'user')
            authorizeUrl.searchParams.set('redirect_uri', redirectUri)
            authorizeUrl.searchParams.set('state', oauthState)
            res.statusCode = 302
            res.setHeader('Location', authorizeUrl.toString())
            res.end()
          })

          // ── OAuth callback ───────────────────────────────────────────────
          server.middlewares.use('/notion-oauth/callback', async (req, res) => {
            const callbackUrl = new URL(req.url || '', getLocalOrigin(env))
            const code = callbackUrl.searchParams.get('code')
            const state = callbackUrl.searchParams.get('state')

            if (!code || !state || state !== oauthState) {
              sendHtml(res, notionResultPage('Connection Failed', 'Missing or invalid OAuth state. Please try again.', false))
              return
            }

            try {
              const token = await exchangeNotionCode(code, env)
              notionAccessToken = token.access_token || ''
              notionWorkspace = token.workspace_name || token.workspace_id || ''
              connectionMode = 'oauth'
              sendHtml(res, notionResultPage('Notion Connected!', `Connected to <strong>${escapeHtml(notionWorkspace || 'your workspace')}</strong>. You can close this tab and return to WikiMind.`, true))
            } catch (err) {
              sendHtml(res, notionResultPage('Connection Failed', escapeHtml(err.message), false))
            }
          })

          // ── Disconnect ───────────────────────────────────────────────────
          server.middlewares.use('/notion-oauth/disconnect', (_req, res) => {
            // Only clear OAuth tokens, not the env-based API key
            if (connectionMode === 'oauth') {
              notionAccessToken = env.NOTION_API_KEY || env.VITE_NOTION_API_KEY || ''
              connectionMode = notionAccessToken ? 'api_key' : ''
            } else {
              // Clear everything
              notionAccessToken = ''
              connectionMode = ''
            }
            notionWorkspace = ''
            sendJson(res, { disconnected: true })
          })

          // ── List accessible pages ────────────────────────────────────────
          server.middlewares.use('/notion-oauth/pages', async (req, res) => {
            if (!notionAccessToken) {
              sendJson(res, { pages: [], error: 'Not connected' }, 401)
              return
            }

            try {
              const url = new URL(req.url || '', getLocalOrigin(env))
              const cursor = url.searchParams.get('cursor') || undefined
              const query = url.searchParams.get('query') || ''
              const pageSize = Math.min(parseInt(url.searchParams.get('page_size') || '20', 10), 50)

              const body = {
                page_size: pageSize,
                filter: { property: 'object', value: 'page' },
              }
              if (cursor) body.start_cursor = cursor
              if (query) body.query = query

              const searchRes = await fetch('https://api.notion.com/v1/search', {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${notionAccessToken}`,
                  'Notion-Version': env.NOTION_VERSION || '2022-06-28',
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
              })

              if (!searchRes.ok) {
                const errBody = await searchRes.text()
                sendJson(res, { pages: [], error: `Notion API ${searchRes.status}: ${errBody}` }, searchRes.status)
                return
              }

              const data = await searchRes.json()
              const pages = (data.results || []).map(page => ({
                id: page.id,
                title: getPageTitleFromProperties(page),
                url: page.url || '',
                icon: page.icon?.emoji || page.icon?.external?.url || '',
                lastEdited: page.last_edited_time || '',
                object: page.object,
              }))

              sendJson(res, {
                pages,
                hasMore: data.has_more || false,
                nextCursor: data.next_cursor || null,
              })
            } catch (err) {
              sendJson(res, { pages: [], error: err.message }, 500)
            }
          })

          // ── List accessible databases ────────────────────────────────────
          server.middlewares.use('/notion-oauth/databases', async (req, res) => {
            if (!notionAccessToken) {
              sendJson(res, { databases: [], error: 'Not connected' }, 401)
              return
            }

            try {
              const url = new URL(req.url || '', getLocalOrigin(env))
              const cursor = url.searchParams.get('cursor') || undefined

              const body = {
                page_size: 20,
                filter: { property: 'object', value: 'database' },
              }
              if (cursor) body.start_cursor = cursor

              const searchRes = await fetch('https://api.notion.com/v1/search', {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${notionAccessToken}`,
                  'Notion-Version': env.NOTION_VERSION || '2022-06-28',
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
              })

              if (!searchRes.ok) {
                const errBody = await searchRes.text()
                sendJson(res, { databases: [], error: `Notion API ${searchRes.status}: ${errBody}` }, searchRes.status)
                return
              }

              const data = await searchRes.json()
              const databases = (data.results || []).map(db => ({
                id: db.id,
                title: getPageTitleFromProperties(db) || db.title?.map(t => t.plain_text).join('') || 'Untitled',
                url: db.url || '',
                icon: db.icon?.emoji || db.icon?.external?.url || '',
                lastEdited: db.last_edited_time || '',
                object: db.object,
              }))

              sendJson(res, {
                databases,
                hasMore: data.has_more || false,
                nextCursor: data.next_cursor || null,
              })
            } catch (err) {
              sendJson(res, { databases: [], error: err.message }, 500)
            }
          })
        },
      },
    ],
    server: {
      proxy: {
        '/hydradb-api': {
          target: 'https://api.hydradb.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/hydradb-api/, ''),
          secure: true,
        },
        '/notion-api': {
          target: 'https://api.notion.com/v1',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/notion-api/, ''),
          secure: true,
          configure(proxy) {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('Authorization', `Bearer ${notionAccessToken}`)
              proxyReq.setHeader('Notion-Version', env.NOTION_VERSION || '2022-06-28')
            })
          },
        },
      },
    },
  }
})

function getLocalOrigin(env) {
  return env.NOTION_LOCAL_ORIGIN || 'http://localhost:5173'
}

function getNotionRedirectUri(env) {
  return env.NOTION_REDIRECT_URI || `${getLocalOrigin(env)}/notion-oauth/callback`
}

async function exchangeNotionCode(code, env) {
  const auth = Buffer.from(`${env.NOTION_CLIENT_ID}:${env.NOTION_CLIENT_SECRET}`).toString('base64')
  const res = await fetch('https://api.notion.com/v1/oauth/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      redirect_uri: getNotionRedirectUri(env),
    }),
  })

  const body = await res.text()
  if (!res.ok) throw new Error(`Notion OAuth ${res.status}: ${body}`)
  return JSON.parse(body)
}

async function getNotionUserInfo(token, env) {
  try {
    const res = await fetch('https://api.notion.com/v1/users/me', {
      headers: {
        Authorization: `Bearer ${token}`,
        'Notion-Version': env.NOTION_VERSION || '2022-06-28',
      },
    })
    if (!res.ok) return null
    const data = await res.json()
    return {
      workspace: data.bot?.workspace_name || '',
      botName: data.name || data.bot?.owner?.user?.name || '',
    }
  } catch {
    return null
  }
}

function getPageTitleFromProperties(page) {
  const properties = page.properties || {}
  for (const prop of Object.values(properties)) {
    if (prop.type === 'title' && prop.title) {
      return prop.title.map(t => t.plain_text || '').join('').trim()
    }
  }
  return 'Untitled'
}

function sendJson(res, body, status = 200) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

function sendHtml(res, body, status = 200) {
  res.statusCode = status
  res.setHeader('Content-Type', 'text/html')
  res.end(`<!doctype html><html><head><meta charset="utf-8"><title>WikiMind – Notion</title></head><body>${body}</body></html>`)
}

function notionResultPage(title, message, success) {
  return `
    <div style="
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; margin: 0; background: #f8f9fa;
    ">
      <div style="
        text-align: center; padding: 48px; max-width: 440px;
        background: white; border-radius: 12px;
        box-shadow: 0 4px 24px rgba(0,0,0,0.08);
      ">
        <div style="font-size: 48px; margin-bottom: 16px;">${success ? '✅' : '❌'}</div>
        <h1 style="font-size: 22px; font-weight: 600; margin: 0 0 12px; color: ${success ? '#16a34a' : '#dc2626'};">${title}</h1>
        <p style="font-size: 14px; color: #54595d; line-height: 1.6; margin: 0 0 24px;">${message}</p>
        <p style="font-size: 12px; color: #9ca3af;">This window will close automatically…</p>
      </div>
    </div>
    <script>
      // Notify the opener and close
      if (window.opener) {
        window.opener.postMessage({ type: 'notion-oauth-complete', success: ${success} }, '*');
      }
      setTimeout(() => window.close(), 2500);
    </script>
  `
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
