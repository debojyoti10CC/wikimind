// All requests go through the Vite dev proxy at /hydradb-api → https://api.hydradb.com
// This avoids CORS issues in the browser.
const BASE = '/hydradb-api';
const TENANT = () => import.meta.env.VITE_HYDRADB_TENANT_ID;

function requireConfig() {
  if (!import.meta.env.VITE_HYDRADB_API_KEY) {
    throw new Error('Missing VITE_HYDRADB_API_KEY. Add it to .env and restart the dev server.');
  }
  if (!TENANT()) {
    throw new Error('Missing VITE_HYDRADB_TENANT_ID. Add it to .env and restart the dev server.');
  }
}

function jsonHeaders() {
  requireConfig();
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${import.meta.env.VITE_HYDRADB_API_KEY}`
  };
}

function authHeader() {
  requireConfig();
  return {
    'Authorization': `Bearer ${import.meta.env.VITE_HYDRADB_API_KEY}`
  };
}

// ─── Tenant ───────────────────────────────────────────────────────────────────

export async function ensureTenant() {
  const res = await fetch(
    `${BASE}/tenants/infra/status?tenant_id=${TENANT()}`,
    { headers: jsonHeaders() }
  );
  if (!res.ok) {
    // Try to create it (409 = already exists, that's fine)
    await fetch(`${BASE}/tenants/create`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ tenant_id: TENANT() })
    });
    return false;
  }
  const data = await res.json();
  const infra = data?.infra;
  return (
    infra?.graph_status === true &&
    Array.isArray(infra?.vectorstore_status) &&
    infra.vectorstore_status[1] === true // index 1 = Knowledge store
  );
}

export async function waitForTenant(onProgress, maxWaitMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const ready = await ensureTenant();
      if (ready) return true;
    } catch (err) {
      if (err.message?.startsWith('Missing ')) throw err;
      // ignore transient errors while polling
    }
    onProgress?.('  ⏳ Waiting for HydraDB tenant to provision…');
    await new Promise(r => setTimeout(r, 3000));
  }
  throw new Error('Tenant provisioning timed out. Try again in a moment.');
}

// ─── Store Article (as app_knowledge) ────────────────────────────────────────

export async function storeArticle(slug, content, metadata) {
  const tenantId = TENANT();
  const timestamp = metadata.updated_at || new Date().toISOString();
  const appKnowledge = [{
    tenant_id:    tenantId,
    sub_tenant_id: 'articles',
    id:           slug,           // upsert key
    title:        metadata.title || slug,
    type:         'wiki_article',
    timestamp,
    content:      { text: content, markdown: content },
    metadata: {
      app: 'wikimind',
      directory: metadata.directory || 'misc',
      slug,
      type: 'wiki_article',
    },
    additional_metadata: {
      slug,
      directory:       metadata.directory || 'misc',
      summary:         metadata.summary || '',
      wikilinks:       JSON.stringify(metadata.wikilinks || []),
      version:         String(metadata.version || 1),
      created_at:      metadata.created_at || new Date().toISOString(),
      updated_at:      metadata.updated_at || new Date().toISOString(),
      word_count:      String(metadata.word_count || 0),
      source_entries:  JSON.stringify(metadata.source_entries || []),
      version_history: JSON.stringify(metadata.version_history || []),
    }
  }];

  const formData = new FormData();
  formData.append('tenant_id', tenantId);
  formData.append('sub_tenant_id', 'articles');
  formData.append('upsert', 'true');
  formData.append('app_knowledge', JSON.stringify(appKnowledge));

  const res = await fetch(`${BASE}/ingestion/upload_knowledge`, {
    method: 'POST',
    headers: authHeader(),
    body: formData
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`HydraDB storeArticle ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data?.results?.[0]?.source_id || slug;
}

// ─── Store Raw Source Entry ───────────────────────────────────────────────────

export async function storeSource(content, metadata) {
  const tenantId = TENANT();
  const timestamp = safeIsoDate(metadata.date) || new Date().toISOString();
  const appKnowledge = [{
    tenant_id:    tenantId,
    sub_tenant_id: 'sources',
    id:           metadata.entry_id || `source_${Date.now()}`,
    title:        `Entry: ${metadata.date || 'unknown'}`,
    type:         'diary_entry',
    timestamp,
    content:      { text: content },
    metadata: {
      app: 'wikimind',
      source_type: metadata.source_type || 'plain_text',
      date: metadata.date || '',
    },
    additional_metadata: {
      entry_id:        metadata.entry_id || '',
      date:            metadata.date || '',
      source_type:     metadata.source_type || 'plain_text',
      source_filename: metadata.source_filename || '',
      ingested_at:     new Date().toISOString(),
      absorbed:        'false',
    }
  }];

  const formData = new FormData();
  formData.append('tenant_id', tenantId);
  formData.append('sub_tenant_id', 'sources');
  formData.append('upsert', 'true');
  formData.append('app_knowledge', JSON.stringify(appKnowledge));

  const res = await fetch(`${BASE}/ingestion/upload_knowledge`, {
    method: 'POST',
    headers: authHeader(),
    body: formData
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`HydraDB storeSource ${res.status}: ${err}`);
  }
  return res.json();
}

// ─── Recall Articles ──────────────────────────────────────────────────────────

export async function recallArticle(query, subTenantId = 'articles') {
  const res = await fetch(`${BASE}/recall/full_recall`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({
      tenant_id:     TENANT(),
      sub_tenant_id: subTenantId,
      query,
      max_results:   10,
      mode:          'thinking',
      graph_context: true,
    })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`HydraDB recallArticle ${res.status}: ${err}`);
  }
  const data = await res.json();
  const chunks = data?.chunks || [];
  return {
    results: chunks.map(normalizeRecallChunk)
  };
}

export async function recallSources(query) {
  return recallArticle(query, 'sources');
}

function normalizeRecallChunk(chunk) {
  const meta = getSourceMetadata(chunk);
  return {
      content: chunk.chunk_content || '',
      metadata: {
        title:           chunk.source_title || '',
        slug:            meta.slug || chunk.source_id || '',
        directory:       meta.directory || 'misc',
        summary:         meta.summary || '',
        wikilinks:       safeParseJson(meta.wikilinks, []),
        version:         toInt(meta.version, 1),
        created_at:      meta.created_at || '',
        updated_at:      meta.updated_at || '',
        entry_id:        meta.entry_id || chunk.source_id || '',
        source_entries:  safeParseJson(meta.source_entries, []),
        version_history: safeParseJson(meta.version_history, []),
      }
  };
}

// ─── List All Articles ────────────────────────────────────────────────────────

export async function listAllArticles() {
  const sources = await listKnowledgeSources({ subTenantId: 'articles' });
  return { results: sources.map(normalizeSource).filter(r => r.metadata.slug) };
}

// ─── Fetch Single Article by Slug ─────────────────────────────────────────────

export async function fetchArticleBySlug(slug) {
  const listed = await listKnowledgeSources({ subTenantId: 'articles', sourceIds: [slug], pageSize: 1 });
  const exact = listed.map(normalizeSource).find(item => item.metadata.slug === slug);
  if (exact) return exact;

  const res = await fetch(`${BASE}/recall/full_recall`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({
      tenant_id:     TENANT(),
      sub_tenant_id: 'articles',
      query:         slug,
      max_results:   5,
      mode:          'thinking',
      graph_context: true,
    })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`HydraDB fetchArticleBySlug ${res.status}: ${err}`);
  }
  const data = await res.json();
  const chunks = data?.chunks || [];
  const match = chunks.find(c => getSourceMetadata(c).slug === slug);
  if (!match) return null;

  return normalizeRecallChunk(match);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function listKnowledgeSources({ subTenantId, sourceIds, pageSize = 100 } = {}) {
  const sources = [];
  let page = 1;
  let hasNext = true;

  while (hasNext) {
    const body = {
      tenant_id: TENANT(),
      sub_tenant_id: subTenantId,
      kind: 'knowledge',
      page,
      page_size: pageSize,
      include_fields: ['title', 'type', 'timestamp', 'document_metadata', 'tenant_metadata', 'content']
    };
    if (sourceIds?.length) body.source_ids = sourceIds;

    const res = await fetch(`${BASE}/list/data`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`HydraDB list/data ${res.status}: ${err}`);
    }
    const data = await res.json();
    sources.push(...(data?.sources || []));
    hasNext = Boolean(data?.pagination?.has_next) && !sourceIds?.length;
    page += 1;
  }

  return sources;
}

function normalizeSource(src) {
  const meta = getSourceMetadata(src);
  const content = src.content?.markdown || src.content?.text || src.note || '';
  return {
    content,
    metadata: {
      title:           src.title || src.id || 'Untitled',
      slug:            meta.slug || src.id || '',
      directory:       meta.directory || 'misc',
      summary:         meta.summary || '',
      wikilinks:       safeParseJson(meta.wikilinks, []),
      version:         toInt(meta.version, 1),
      created_at:      meta.created_at || src.timestamp || '',
      updated_at:      meta.updated_at || src.timestamp || '',
      word_count:      toInt(meta.word_count, wordCount(content)),
      source_entries:  safeParseJson(meta.source_entries, []),
      version_history: safeParseJson(meta.version_history, []),
    }
  };
}

function getSourceMetadata(item) {
  return {
    ...(item?.metadata || {}),
    ...(item?.tenant_metadata || {}),
    ...(item?.meta || {}),
    ...(item?.document_metadata || {}),
    ...(item?.additional_metadata || {}),
  };
}

function safeParseJson(str, fallback) {
  if (!str) return fallback;
  if (Array.isArray(str)) return str;
  if (typeof str !== 'string') return str ?? fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}

function toInt(value, fallback) {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function wordCount(text) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  return words.length;
}

function safeIsoDate(value) {
  if (!value || value === 'unknown') return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}
