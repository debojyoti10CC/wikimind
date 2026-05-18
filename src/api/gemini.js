const GEMINI_MODEL = import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${import.meta.env.VITE_GEMINI_API_KEY}`;

// ─── Rate-limit aware fetch with retry ───────────────────────────────────────

async function callGeminiWithRetry(prompt, maxTokens, retries = 4) {
  if (!import.meta.env.VITE_GEMINI_API_KEY) {
    throw new Error('Missing VITE_GEMINI_API_KEY. Add it to .env and restart the dev server.');
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: maxTokens, temperature: 0.7 }
      })
    });

    if (res.ok) {
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }

    const errText = await res.text();

    if (res.status === 429) {
      // Parse retryDelay from the error body if present
      let waitMs = 15000; // default 15s
      try {
        const errJson = JSON.parse(errText);
        const retryInfo = errJson?.error?.details?.find(d =>
          d['@type']?.includes('RetryInfo')
        );
        if (retryInfo?.retryDelay) {
          // retryDelay is like "54s" or "54.3s"
          const secs = parseFloat(retryInfo.retryDelay.replace('s', ''));
          if (!isNaN(secs)) waitMs = Math.ceil(secs * 1000) + 1000; // +1s buffer
        }
      } catch { /* use default */ }

      if (attempt < retries) {
        console.log(`Gemini 429 — waiting ${Math.round(waitMs / 1000)}s before retry ${attempt + 1}/${retries}…`);
        await new Promise(r => setTimeout(r, waitMs));
        continue;
      }
    }

    throw new Error(`Gemini API error ${res.status}: ${errText}`);
  }
}

export async function callGemini(prompt, maxTokens = 2000) {
  return callGeminiWithRetry(prompt, maxTokens);
}

export async function extractEntities(entryText) {
  const prompt = `Read this personal diary/note entry and extract named entities.

Entry: ${entryText.slice(0, 3000)}

Return ONLY valid JSON, no explanation:
{
  "people": ["names of specific people mentioned"],
  "places": ["specific places, cities, venues"],
  "projects": ["named projects, startups, initiatives, products"],
  "ideas": ["recurring concepts, philosophies, obsessions with clear names"],
  "events": ["named events, turning points, specific occasions"],
  "media": ["books, films, shows, music explicitly mentioned"]
}

Rules:
- Only include things with proper names or clear identity
- "my friend" is not an entity. "Rahul" is.
- "a startup" is not an entity. "Zepto" or "my fintech startup" is.
- Return empty arrays if nothing qualifies
- No generic concepts like "love", "work", "life"`;

  const response = await callGemini(prompt, 500);
  try {
    const cleaned = extractJsonObject(response);
    return JSON.parse(cleaned);
  } catch {
    return { people: [], places: [], projects: [], ideas: [], events: [], media: [] };
  }
}

function extractJsonObject(text) {
  const cleaned = text.replace(/```(?:json)?\n?/g, '').replace(/```\n?/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start >= 0 && end > start) return cleaned.slice(start, end + 1);
  return cleaned;
}

export async function createArticle(entityName, directory, entryTexts) {
  const combinedEntries = entryTexts.slice(0, 3).join('\n\n---\n\n').slice(0, 5000);

  const prompt = `You are writing a Wikipedia article for someone's PERSONAL wiki — like Farzapedia.
This wiki is about one person's life: their friends, projects, ideas, decisions.

Write a Wikipedia-style article about: "${entityName}"
Category: ${directory}

Based on these personal diary/note entries:
${combinedEntries}

Rules:
1. Start with # ${entityName}
2. Write in third person about the subject ("Rahul is...", "The project was...")
   EXCEPT when quoting or referencing the wiki owner's feelings/perspective
3. Use proper Wikipedia structure: intro paragraph, then ## sections
4. Sections should be thematic, NOT chronological diary dumps
   BAD: "## March 2024", "## April 2024"
   GOOD: "## How We Met", "## The Project We Built", "## Current Status"
5. Use [[Entity Name]] for any person, place, project, or idea that could have its own article
6. Be specific. Use real names, real dates, real emotions when present in the source.
7. Minimum 300 words. Aim for 400-600 words.
8. End with exactly: SUMMARY: <one sentence capturing who/what this is>
9. End with exactly: DIRECTORY: ${directory}

Return ONLY the markdown. No preamble.`;

  return callGemini(prompt, 2000);
}

export async function updateArticle(entityName, existingContent, newEntryText, version) {
  const prompt = `You are maintaining a personal Wikipedia article. Update it with new information from a diary entry.

EXISTING ARTICLE (v${version - 1}):
${existingContent}

NEW DIARY/NOTE ENTRY:
${newEntryText.slice(0, 3000)}

Rules:
1. Keep all existing correct information
2. Integrate new information naturally — expand sections, add new sections, add nuance
3. If new entry CONTRADICTS existing content: > ⚠️ **Note:** [explain the tension]
4. Update or add [[wikilinks]] as appropriate
5. Never make it a chronological dump. Keep it thematic and Wikipedia-like.
6. End with: SUMMARY: <updated one-sentence summary>
7. Return ONLY the updated markdown. Start with # Title.`;

  return callGemini(prompt, 2000);
}

export async function answerQuery(question, articleIndex) {
  const prompt = `You are an AI with access to someone's personal Wikipedia — a structured knowledge base about their life.

Here is the index of all articles in the wiki:
${articleIndex}

The user asks: "${question}"

Instructions:
1. Answer ONLY from what the wiki contains
2. Cite specific article names when referencing information
3. If the wiki doesn't cover something, say so directly
4. Suggest what kinds of entries the user could add to answer this better
5. Be personal and specific — this is THEIR life, not generic advice

Answer:`;

  return callGemini(prompt, 1000);
}
