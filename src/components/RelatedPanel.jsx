import { Link } from 'react-router-dom';
import { useWiki } from '../context/useWiki';
import { DIRECTORY_ICONS } from '../lib/graph';

export default function RelatedPanel({ article }) {
  const { articles, backlinks } = useWiki();
  if (!article) return null;

  const linkedArticles = (article.wikilinks || [])
    .map(name => articles.find(a => a.title?.toLowerCase() === name.toLowerCase()))
    .filter(Boolean)
    .slice(0, 10);

  const backlinkSlugs = backlinks[article.slug] || [];
  const backlinkArticles = backlinkSlugs
    .map(slug => articles.find(a => a.slug === slug))
    .filter(Boolean)
    .slice(0, 10);

  return (
    <div className="wiki-infobox">
      {/* Article info */}
      <div className="wiki-infobox-section">
        <p className="wiki-infobox-heading">Article info</p>
        <div className="wiki-infobox-meta">
          <div style={{ marginBottom: 4 }}>
            <span style={{ textTransform: 'capitalize' }}>
              {DIRECTORY_ICONS[article.directory] || '📄'} {article.directory}
            </span>
          </div>
          <div style={{ marginBottom: 4 }}>Version {article.version}</div>
          {article.word_count > 0 && (
            <div style={{ marginBottom: 4 }}>{article.word_count} words</div>
          )}
          {article.updated_at && (
            <div style={{ marginBottom: 4 }}>
              Updated {new Date(article.updated_at).toLocaleDateString()}
            </div>
          )}
          {article.source_entries?.length > 0 && (
            <div>{article.source_entries.length} source {article.source_entries.length === 1 ? 'entry' : 'entries'}</div>
          )}
        </div>
      </div>

      {/* Related */}
      {linkedArticles.length > 0 && (
        <div className="wiki-infobox-section">
          <p className="wiki-infobox-heading">See also</p>
          {linkedArticles.map(a => (
            <Link key={a.slug} to={`/wiki/${a.slug}`} className="wiki-infobox-link">
              {DIRECTORY_ICONS[a.directory] || '📄'} {a.title}
            </Link>
          ))}
        </div>
      )}

      {/* Backlinks */}
      {backlinkArticles.length > 0 && (
        <div className="wiki-infobox-section">
          <p className="wiki-infobox-heading">Referenced by</p>
          {backlinkArticles.map(a => (
            <Link key={a.slug} to={`/wiki/${a.slug}`} className="wiki-infobox-link">
              {DIRECTORY_ICONS[a.directory] || '📄'} {a.title}
            </Link>
          ))}
        </div>
      )}

      {/* Version history */}
      {article.version_history?.length > 0 && (
        <div className="wiki-infobox-section">
          <p className="wiki-infobox-heading">History</p>
          <div className="wiki-infobox-meta">
            {[...article.version_history].reverse().slice(0, 5).map((v, i) => (
              <div key={i} style={{ marginBottom: 3 }}>
                v{v.version} · {v.updated_at
                  ? new Date(v.updated_at).toLocaleDateString()
                  : '—'}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
