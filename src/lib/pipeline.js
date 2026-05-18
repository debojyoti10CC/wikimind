import { storeArticle, storeSource, recallArticle, waitForTenant } from '../api/hydradb';
import { extractEntities, createArticle, updateArticle } from '../api/gemini';

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function parseSummary(text) {
  const match = text.match(/SUMMARY:\s*(.+)$/m);
  return match ? match[1].trim() : '';
}

export function parseDirectory(text, fallback) {
  const match = text.match(/DIRECTORY:\s*(.+)$/m);
  return normalizeDirectory(match ? match[1] : fallback);
}

export function cleanArticle(text) {
  return text
    .replace(/\nSUMMARY:.*$/m, '')
    .replace(/\nDIRECTORY:.*$/m, '')
    .trim();
}

export function extractWikilinks(markdown) {
  const matches = [...markdown.matchAll(/\[\[([^\]]+)\]\]/g)];
  return [...new Set(matches.map(m => m[1]))];
}

export function entityToSlug(directory, name) {
  const clean = String(name || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return `${normalizeDirectory(directory)}-${clean || 'untitled'}`;
}

function normalizeDirectory(value) {
  return String(value || 'misc')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'misc';
}

// ─── Rate limiting ────────────────────────────────────────────────────────────
// Gemini 2.5 Flash free tier allows ~15 RPM. We enforce a minimum gap between calls.
const GEMINI_MIN_GAP_MS = 4000; // 4s → max ~15 req/min
let lastGeminiCallAt = 0;

async function rateLimitedGemini(fn, onProgress) {
  const now = Date.now();
  const elapsed = now - lastGeminiCallAt;
  if (elapsed < GEMINI_MIN_GAP_MS) {
    const wait = GEMINI_MIN_GAP_MS - elapsed;
    const secs = Math.ceil(wait / 1000);
    onProgress?.(`  ⏱ Rate limit pause: ${secs}s…`);
    await new Promise(r => setTimeout(r, wait));
  }
  lastGeminiCallAt = Date.now();
  return fn();
}

// ─── Main Pipeline ────────────────────────────────────────────────────────────

export async function runAbsorptionPipeline(entries, onProgress, onStats) {
  const results = { created: [], updated: [], errors: [] };
  const total = entries.length;

  // Ensure tenant is provisioned before starting
  onProgress('Checking HydraDB tenant status…');
  try {
    await waitForTenant(onProgress, 60000);
    onProgress('✓ HydraDB tenant ready.');
  } catch (err) {
    if (err.message?.startsWith('Missing ')) throw err;
    onProgress(`⚠️ ${err.message} — proceeding anyway.`);
  }

  // Sort chronologically
  entries.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    onStats({
      total,
      processed: i + 1,
      created: results.created.length,
      updated: results.updated.length
    });

    try {
      // STEP 1: Store raw entry
      onProgress(`[${i + 1}/${total}] Storing entry: ${entry.date || entry.entry_id}`);
      await storeSource(entry.text, {
        entry_id: entry.entry_id,
        date: entry.date,
        source_type: entry.source_type,
        source_filename: entry.source_filename || '',
        ingested_at: new Date().toISOString(),
        absorbed: false,
        articles_touched: []
      });

      // STEP 2: Extract entities
      onProgress(`[${i + 1}/${total}] Extracting entities...`);
      const entities = await rateLimitedGemini(() => extractEntities(entry.text, onProgress), onProgress);

      const allEntities = [
        ...(entities.people   || []).map(n => ({ name: n, dir: 'people' })),
        ...(entities.places   || []).map(n => ({ name: n, dir: 'places' })),
        ...(entities.projects || []).map(n => ({ name: n, dir: 'projects' })),
        ...(entities.ideas    || []).map(n => ({ name: n, dir: 'ideas' })),
        ...(entities.events   || []).map(n => ({ name: n, dir: 'events' })),
        ...(entities.media    || []).map(n => ({ name: n, dir: 'media' }))
      ].filter(e => e.name && e.name.trim().length > 1);

      if (allEntities.length === 0) {
        onProgress(`[${i + 1}/${total}] No named entities found, skipping.`);
        continue;
      }

      onProgress(`[${i + 1}/${total}] Found: ${allEntities.map(e => e.name).join(', ')}`);

      // STEP 3 + 4: Recall then create/update for each entity
      for (const entity of allEntities) {
        const slug = entityToSlug(entity.dir, entity.name);

        try {
          const recall = await recallArticle(entity.name);
          const existing = (recall?.results || []).find(result => {
            const title = result.metadata?.title || '';
            const resultSlug = result.metadata?.slug || '';
            return title.toLowerCase() === entity.name.toLowerCase() ||
              resultSlug === slug;
          });
          const isMatch = existing &&
            existing.metadata?.title?.toLowerCase() === entity.name.toLowerCase();

          let articleText;
          let version = 1;

          if (isMatch) {
            version = (existing.metadata.version || 1) + 1;
            onProgress(`  ↻ Updating: ${entity.name} (v${version})`);
            articleText = await rateLimitedGemini(() =>
              updateArticle(entity.name, existing.content, entry.text, version, onProgress),
              onProgress
            );
            results.updated.push(entity.name);
          } else {
            onProgress(`  + Creating: ${entity.name} (${entity.dir})`);
            articleText = await rateLimitedGemini(() =>
              createArticle(entity.name, entity.dir, [entry.text], onProgress),
              onProgress
            );
            results.created.push(entity.name);
          }

          const summary   = parseSummary(articleText);
          const directory = parseDirectory(articleText, entity.dir);
          const storedSlug = entityToSlug(directory, entity.name);
          const clean     = cleanArticle(articleText);
          const wikilinks = extractWikilinks(clean);
          const sourceEntries = [
            ...(existing?.metadata?.source_entries || []),
            entry.entry_id,
          ].filter(Boolean);

          await storeArticle(storedSlug, clean, {
            title: entity.name,
            slug: storedSlug,
            directory,
            version,
            summary,
            wikilinks,
            source_entries: [...new Set(sourceEntries)],
            created_at: existing?.metadata?.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
            word_count: clean.split(/\s+/).length,
            version_history: [
              ...(existing?.metadata?.version_history || []),
              {
                version,
                updated_at: new Date().toISOString(),
                entries_added: 1
              }
            ]
          });

          onProgress(`  ✓ Saved: ${entity.name}`);

        } catch (err) {
          onProgress(`  ✗ Error on ${entity.name}: ${err.message}`);
          results.errors.push(entity.name);
        }
      }

      // CHECKPOINT every 15 entries
      if ((i + 1) % 15 === 0) {
        onProgress(
          `— Checkpoint: ${results.created.length} created, ${results.updated.length} updated so far —`
        );
      }

    } catch (err) {
      onProgress(`✗ Failed entry ${entry.entry_id}: ${err.message}`);
    }
  }

  onProgress(
    `\n✅ Done! ${results.created.length} articles created, ${results.updated.length} updated.`
  );
  return results;
}
