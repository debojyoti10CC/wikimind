import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useWiki } from '../context/useWiki';
import { resolveWikilinks } from '../lib/wikilinks';
import { DIRECTORY_ICONS } from '../lib/graph';

export default function ArticleViewer({ article }) {
  const { articles } = useWiki();
  const navigate = useNavigate();

  if (!article) return null;

  const resolvedContent = resolveWikilinks(article.content || '', articles);

  const handleClick = (e) => {
    const anchor = e.target.closest('a[href^="/wiki/"]');
    if (anchor) {
      e.preventDefault();
      navigate(anchor.getAttribute('href'));
    }
  };

  const icon = DIRECTORY_ICONS[article.directory] || '📄';

  return (
    <article onClick={handleClick}>
      {/* Title */}
      <h1 className="wiki-article-title">{article.title}</h1>

      {/* Meta row */}
      <div className="wiki-article-subtitle">
        <span className="badge">{icon} {article.directory}</span>
        <span>Version {article.version}</span>
        {article.updated_at && (
          <span>Last updated {new Date(article.updated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
        )}
        {article.word_count > 0 && <span>{article.word_count.toLocaleString()} words</span>}
      </div>

      {/* Body */}
      <div className="wiki-article-body clearfix">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            // Skip h1 — we render the title ourselves above
            h1: () => null,
            h2: ({ children }) => <h2>{children}</h2>,
            h3: ({ children }) => <h3>{children}</h3>,
            p:  ({ children }) => <p>{children}</p>,
            a: ({ href, children }) => {
              if (href?.startsWith('/wiki/')) {
                return (
                  <a
                    href={href}
                    className={href.startsWith('/wiki/missing') ? 'missing-link' : undefined}
                    onClick={e => { e.preventDefault(); navigate(href); }}
                  >
                    {children}
                  </a>
                );
              }
              return <a href={href} target="_blank" rel="noreferrer">{children}</a>;
            },
            ul: ({ children }) => <ul>{children}</ul>,
            ol: ({ children }) => <ol>{children}</ol>,
            li: ({ children }) => <li>{children}</li>,
            blockquote: ({ children }) => <blockquote>{children}</blockquote>,
            code: ({ inline, children }) =>
              inline
                ? <code>{children}</code>
                : <pre><code>{children}</code></pre>,
            strong: ({ children }) => <strong>{children}</strong>,
            em:     ({ children }) => <em>{children}</em>,
          }}
        >
          {resolvedContent}
        </ReactMarkdown>
      </div>

      {/* Footer */}
      {article.source_entries?.length > 0 && (
        <div style={{
          marginTop: 32,
          paddingTop: 12,
          borderTop: '1px solid #eaecf0',
          fontSize: 12,
          color: '#54595d',
          fontFamily: 'sans-serif',
        }}>
          This article was compiled from{' '}
          <strong>{article.source_entries.length}</strong>{' '}
          personal {article.source_entries.length === 1 ? 'entry' : 'entries'}.
        </div>
      )}
    </article>
  );
}
