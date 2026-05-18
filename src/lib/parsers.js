// ─── Format Detection ────────────────────────────────────────────────────────

export function detectFormat(filename, content) {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.json') && content.includes('"entries"')) return 'dayone';
  if (lower.endsWith('.html')) return 'apple_notes';
  if (lower.endsWith('.csv') && content.toLowerCase().includes('message')) return 'imessage';
  if (lower.endsWith('.md') || lower.endsWith('.txt')) return 'plain_text';
  if (lower.endsWith('.json')) return 'generic_json';
  return 'plain_text';
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractDateFromFilename(filename) {
  const match = filename.match(/(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

// ─── Day One JSON ─────────────────────────────────────────────────────────────

export function parseDayOne(jsonContent) {
  const data = JSON.parse(jsonContent);
  const entries = data.entries || [];
  return entries.map(entry => ({
    entry_id: entry.uuid || `dayone_${Math.random().toString(36).slice(2)}`,
    date: entry.creationDate?.slice(0, 10) || 'unknown',
    source_type: 'diary_dayone',
    text: entry.text || '',
    tags: entry.tags || [],
    location: entry.location?.placeName || null
  })).filter(e => e.text.trim().length > 0);
}

// ─── Apple Notes HTML ─────────────────────────────────────────────────────────

export function parseAppleNote(htmlContent, filename) {
  const div = document.createElement('div');
  div.innerHTML = htmlContent;
  const text = div.textContent || div.innerText || '';
  return [{
    entry_id: filename,
    date: extractDateFromFilename(filename) || new Date().toISOString().slice(0, 10),
    source_type: 'apple_notes',
    text: text.trim(),
    tags: []
  }].filter(e => e.text.length > 0);
}

// ─── Plain Text / Markdown ────────────────────────────────────────────────────

export function parsePlainText(content, filename) {
  // Split on date headers: ## 2024-03-01 or --- 2024-03-01 or just 2024-03-01 on its own line
  const dateHeaderPattern = /^(?:#+\s*|---\s*)?(\d{4}-\d{2}-\d{2})\s*$/m;

  if (dateHeaderPattern.test(content)) {
    // Split by date markers
    const parts = content.split(/^(?:#+\s*|---\s*)?(\d{4}-\d{2}-\d{2})\s*$/m);
    const results = [];
    let i = 0;
    while (i < parts.length) {
      const dateMatch = parts[i]?.match(/^\d{4}-\d{2}-\d{2}$/);
      if (dateMatch) {
        const date = parts[i].trim();
        const text = (parts[i + 1] || '').trim();
        if (text.length > 10) {
          results.push({
            entry_id: `${filename}_${date}_${results.length}`,
            date,
            source_type: 'plain_text',
            text
          });
        }
        i += 2;
      } else {
        // Leading content before first date
        const text = parts[i]?.trim();
        if (text && text.length > 10) {
          results.push({
            entry_id: `${filename}_0`,
            date: extractDateFromFilename(filename) || 'unknown',
            source_type: 'plain_text',
            text
          });
        }
        i++;
      }
    }
    if (results.length > 0) return results;
  }

  // Single entry fallback
  return [{
    entry_id: filename,
    date: extractDateFromFilename(filename) || 'unknown',
    source_type: 'plain_text',
    text: content.trim()
  }].filter(e => e.text.length > 0);
}

// ─── iMessage CSV ─────────────────────────────────────────────────────────────

export function parseIMessage(csvContent) {
  const rows = parseCsv(csvContent).filter(row => row.some(Boolean));
  if (rows.length < 2) return [];
  const headers = rows[0].map(h => h.trim().replace(/^"|"$/g, ''));

  const dateIdx = headers.findIndex(h => /date/i.test(h));
  const senderIdx = headers.findIndex(h => /sender|from/i.test(h));
  const textIdx = headers.findIndex(h => /text|body|message/i.test(h));
  const contactIdx = headers.findIndex(h => /contact|name/i.test(h));

  return rows.slice(1).map((clean, i) => {
    const date = dateIdx >= 0 ? (clean[dateIdx] || '').slice(0, 10) : 'unknown';
    const sender = senderIdx >= 0 ? clean[senderIdx] : 'unknown';
    const text = textIdx >= 0 ? clean[textIdx] : '';
    const contact = contactIdx >= 0 ? clean[contactIdx] : 'unknown';

    return {
      entry_id: `imessage_${i}`,
      date: date || 'unknown',
      source_type: 'imessage',
      text: `[${sender}]: ${text}`,
      contact
    };
  }).filter(e => e.text.length > 5);
}

function parseCsv(content) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const next = content[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      row.push(cell.trim());
      cell = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i++;
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell.trim());
    rows.push(row);
  }

  return rows;
}

// ─── Generic JSON ─────────────────────────────────────────────────────────────

export function parseGenericJson(jsonContent, filename) {
  try {
    const data = JSON.parse(jsonContent);
    const items = Array.isArray(data) ? data : [data];
    return items.map((item, i) => ({
      entry_id: `${filename}_${i}`,
      date: item.date || item.created_at || item.timestamp || 'unknown',
      source_type: 'generic_json',
      text: item.text || item.content || item.body || item.note || JSON.stringify(item)
    })).filter(e => e.text && e.text.length > 0);
  } catch {
    return [];
  }
}

// ─── Master Parser ────────────────────────────────────────────────────────────

export function parseFile(filename, content) {
  const format = detectFormat(filename, content);
  switch (format) {
    case 'dayone':      return parseDayOne(content);
    case 'apple_notes': return parseAppleNote(content, filename);
    case 'imessage':    return parseIMessage(content);
    case 'generic_json': return parseGenericJson(content, filename);
    case 'plain_text':
    default:            return parsePlainText(content, filename);
  }
}
