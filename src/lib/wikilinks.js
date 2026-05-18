/**
 * Resolve [[Entity Name]] wikilinks in markdown to either
 * a real article link or a "missing" span.
 */
export function resolveWikilinks(markdown, articles) {
  return markdown.replace(/\[\[([^\]]+)\]\]/g, (match, name) => {
    const slug = nameToSlug(name, articles);
    if (slug) {
      return `[${name}](/wiki/${slug})`;
    }
    return `[${name}](/wiki/missing?name=${encodeURIComponent(name)})`;
  });
}

function nameToSlug(name, articles) {
  const found = articles.find(a =>
    a.title?.toLowerCase() === name.toLowerCase()
  );
  return found?.slug || null;
}

/**
 * Build a reverse map: slug → [slugs that link to it]
 */
export function buildBacklinks(articles) {
  const backlinks = {};
  articles.forEach(article => {
    (article.wikilinks || []).forEach(linkedName => {
      const targetArticle = articles.find(a =>
        a.title?.toLowerCase() === linkedName.toLowerCase()
      );
      if (targetArticle) {
        if (!backlinks[targetArticle.slug]) backlinks[targetArticle.slug] = [];
        if (!backlinks[targetArticle.slug].includes(article.slug)) {
          backlinks[targetArticle.slug].push(article.slug);
        }
      }
    });
  });
  return backlinks;
}

/**
 * Extract all [[wikilink]] names from a markdown string.
 */
export function extractWikilinks(markdown) {
  const matches = [...markdown.matchAll(/\[\[([^\]]+)\]\]/g)];
  return [...new Set(matches.map(m => m[1]))];
}
