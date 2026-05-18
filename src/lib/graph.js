export const DIRECTORY_COLORS = {
  people:    '#3b82f6',  // blue
  projects:  '#f97316',  // orange
  places:    '#22c55e',  // green
  ideas:     '#a855f7',  // purple
  events:    '#ef4444',  // red
  decisions: '#eab308',  // yellow
  patterns:  '#6b7280',  // gray
  media:     '#ec4899',  // pink
};

export const DIRECTORY_ICONS = {
  people:    '👤',
  projects:  '🏗️',
  places:    '📍',
  ideas:     '💡',
  events:    '📅',
  decisions: '🎯',
  patterns:  '🔄',
  media:     '🎬',
};

export function buildGraphData(articles, backlinks) {
  const nodes = articles.map(a => ({
    id: a.slug,
    label: a.title,
    val: Math.max(1, (backlinks[a.slug] || []).length) + 1,
    color: DIRECTORY_COLORS[a.directory] || '#6b7280',
    summary: a.summary,
    directory: a.directory
  }));

  const links = [];
  articles.forEach(article => {
    (article.wikilinks || []).forEach(linkedName => {
      const target = articles.find(a =>
        a.title?.toLowerCase() === linkedName.toLowerCase()
      );
      if (target) {
        links.push({
          source: article.slug,
          target: target.slug,
          color: 'rgba(150,150,150,0.3)'
        });
      }
    });
  });

  return { nodes, links };
}
