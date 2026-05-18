const BASE = '/notion-api';

/**
 * Get current Notion connection status from the dev server.
 */
export async function getNotionConnectionStatus() {
  const res = await fetch('/notion-oauth/status');
  if (!res.ok) return { configured: false, connected: false, workspace: '' };
  return res.json();
}

/**
 * Start OAuth flow — opens in a popup window and returns a promise
 * that resolves when the OAuth completes (via postMessage from the callback page).
 */
export function startNotionOAuth() {
  return new Promise((resolve) => {
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      '/notion-oauth/start',
      'notion-oauth',
      `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,status=no`
    );

    // Listen for the postMessage from the callback page
    function onMessage(event) {
      if (event.data?.type === 'notion-oauth-complete') {
        window.removeEventListener('message', onMessage);
        clearInterval(pollTimer);
        resolve(event.data.success);
      }
    }
    window.addEventListener('message', onMessage);

    // Fallback: poll whether popup is closed
    const pollTimer = setInterval(() => {
      if (popup && popup.closed) {
        clearInterval(pollTimer);
        window.removeEventListener('message', onMessage);
        resolve(true); // Assume success, will re-check status
      }
    }, 500);
  });
}

/**
 * Disconnect the current Notion connection.
 */
export async function disconnectNotion() {
  const res = await fetch('/notion-oauth/disconnect', { method: 'POST' });
  return res.ok;
}

/**
 * List pages accessible to the Notion integration.
 */
export async function listNotionPages(query = '', cursor = null) {
  const params = new URLSearchParams();
  if (query) params.set('query', query);
  if (cursor) params.set('cursor', cursor);
  params.set('page_size', '20');

  const res = await fetch(`/notion-oauth/pages?${params}`);
  if (!res.ok) throw new Error('Failed to list Notion pages');
  return res.json();
}

/**
 * List databases accessible to the Notion integration.
 */
export async function listNotionDatabases(cursor = null) {
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);

  const res = await fetch(`/notion-oauth/databases?${params}`);
  if (!res.ok) throw new Error('Failed to list Notion databases');
  return res.json();
}

/**
 * Import pages/database from a URL, page ID, or database:id target string.
 */
export async function importNotionSource(input) {
  const target = parseNotionTarget(input);
  if (!target.id) {
    throw new Error('Paste a Notion page URL, database URL, or 32-character Notion ID.');
  }

  if (target.kind === 'database') {
    return importDatabase(target.id);
  }

  const page = await fetchPage(target.id);
  return [await pageToEntry(page)];
}

/**
 * Import a single page by its ID (for the browse-and-pick UI).
 */
export async function importNotionPageById(pageId) {
  const page = await fetchPage(pageId);
  return pageToEntry(page);
}

// ─── Internal helpers ──────────────────────────────────────────────────────────

function parseNotionTarget(input) {
  const value = String(input || '').trim();
  const explicitDatabase = value.match(/(?:database|db):\s*([0-9a-f-]{32,36})/i);
  const explicitPage = value.match(/page:\s*([0-9a-f-]{32,36})/i);
  const idMatch = value.match(/([0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  const id = normalizeId(explicitDatabase?.[1] || explicitPage?.[1] || idMatch?.[1] || '');

  return {
    id,
    kind: explicitDatabase || /\/database\//i.test(value) ? 'database' : 'page',
  };
}

function normalizeId(id) {
  const compact = String(id || '').replace(/-/g, '').toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(compact)) return '';
  return [
    compact.slice(0, 8),
    compact.slice(8, 12),
    compact.slice(12, 16),
    compact.slice(16, 20),
    compact.slice(20),
  ].join('-');
}

async function importDatabase(databaseId) {
  const pages = [];
  let startCursor;

  do {
    const data = await notionFetch(`/databases/${databaseId}/query`, {
      method: 'POST',
      body: JSON.stringify({
        page_size: 25,
        start_cursor: startCursor,
        sorts: [{ timestamp: 'last_edited_time', direction: 'descending' }],
      }),
    });
    pages.push(...(data.results || []));
    startCursor = data.has_more ? data.next_cursor : null;
  } while (startCursor && pages.length < 100);

  const entries = [];
  for (const page of pages) {
    entries.push(await pageToEntry(page));
  }
  return entries;
}

async function pageToEntry(page) {
  const blocks = await fetchBlockText(page.id);
  const title = getPageTitle(page) || 'Untitled Notion page';
  const date = getPageDate(page);
  const tags = getPageTags(page);
  const propertyLines = tags.length ? `Tags: ${tags.join(', ')}\n\n` : '';
  const text = [`# ${title}`, propertyLines + blocks].filter(Boolean).join('\n\n').trim();

  return {
    entry_id: `notion_${page.id}`,
    date,
    source_type: 'notion',
    source_filename: title,
    text,
    tags,
    notion_page_id: page.id,
    notion_url: page.url || '',
  };
}

async function fetchPage(pageId) {
  return notionFetch(`/pages/${pageId}`);
}

async function fetchBlockText(blockId, depth = 0) {
  const lines = [];
  let startCursor;

  do {
    const query = new URLSearchParams({ page_size: '100' });
    if (startCursor) query.set('start_cursor', startCursor);
    const data = await notionFetch(`/blocks/${blockId}/children?${query}`);

    for (const block of data.results || []) {
      const line = blockToMarkdown(block);
      if (line) lines.push(line);
      if (block.has_children && depth < 2) {
        const childText = await fetchBlockText(block.id, depth + 1);
        if (childText) lines.push(indentMarkdown(childText));
      }
    }

    startCursor = data.has_more ? data.next_cursor : null;
  } while (startCursor);

  return lines.join('\n').trim();
}

function blockToMarkdown(block) {
  const type = block.type;
  const data = block[type] || {};
  const text = richTextToPlain(data.rich_text);

  switch (type) {
    case 'heading_1': return text ? `# ${text}` : '';
    case 'heading_2': return text ? `## ${text}` : '';
    case 'heading_3': return text ? `### ${text}` : '';
    case 'bulleted_list_item': return text ? `- ${text}` : '';
    case 'numbered_list_item': return text ? `1. ${text}` : '';
    case 'to_do': return text ? `- [${data.checked ? 'x' : ' '}] ${text}` : '';
    case 'quote': return text ? `> ${text}` : '';
    case 'code': return text ? `\`\`\`${data.language || ''}\n${text}\n\`\`\`` : '';
    case 'callout': return text;
    case 'child_page': return data.title ? `## ${data.title}` : '';
    case 'paragraph':
    default:
      return text;
  }
}

function richTextToPlain(richText = []) {
  return richText.map(part => part.plain_text || '').join('').trim();
}

function getPageTitle(page) {
  const properties = page.properties || {};
  const titleProperty = Object.values(properties).find(prop => prop.type === 'title');
  return richTextToPlain(titleProperty?.title || []);
}

function getPageDate(page) {
  const properties = page.properties || {};
  const dateProperty = Object.values(properties).find(prop => prop.type === 'date' && prop.date?.start);
  return (dateProperty?.date?.start || page.created_time || new Date().toISOString()).slice(0, 10);
}

function getPageTags(page) {
  const tags = [];
  for (const prop of Object.values(page.properties || {})) {
    if (prop.type === 'multi_select') tags.push(...prop.multi_select.map(item => item.name));
    if (prop.type === 'select' && prop.select?.name) tags.push(prop.select.name);
    if (prop.type === 'status' && prop.status?.name) tags.push(prop.status.name);
  }
  return [...new Set(tags)];
}

function indentMarkdown(markdown) {
  return markdown
    .split('\n')
    .map(line => line ? `  ${line}` : line)
    .join('\n');
}

async function notionFetch(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 401) {
      throw new Error('Notion is not connected. Click Connect Notion or add a valid NOTION_API_KEY to .env, then restart npm run dev.');
    }
    if (res.status === 404) {
      throw new Error('Notion page or database not found. Share it with your integration and check the ID/URL.');
    }
    throw new Error(`Notion API ${res.status}: ${body}`);
  }

  return res.json();
}
