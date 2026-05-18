import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useWiki } from '../context/useWiki';
import { DIRECTORY_ICONS } from '../lib/graph';

export default function Sidebar() {
  const { articles, directories, isLoading } = useWiki();
  const [expanded, setExpanded] = useState({});
  const location = useLocation();

  const toggle = (dir) => setExpanded(p => ({ ...p, [dir]: !p[dir] }));
  const sortedDirs = Object.keys(directories).sort();

  return (
    <nav className="wiki-sidebar">
      {/* Navigation */}
      <div className="wiki-sidebar-section">
        <p className="wiki-sidebar-heading">Navigation</p>
        <Link to="/" className="wiki-sidebar-link" style={location.pathname === '/' ? { fontWeight: 700 } : {}}>
          Main page
        </Link>
        <Link to="/graph" className="wiki-sidebar-link">Knowledge graph</Link>
        <Link to="/ask" className="wiki-sidebar-link">Ask your wiki</Link>
      </div>

      {/* Stats */}
      <div className="wiki-sidebar-section">
        <p className="wiki-sidebar-heading">Your wiki</p>
        {isLoading ? (
          <span style={{ fontSize: 12, color: '#54595d', fontStyle: 'italic' }}>Loading…</span>
        ) : (
          <span style={{ fontSize: 12, color: '#54595d' }}>
            {articles.length} article{articles.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Directories */}
      {sortedDirs.length > 0 && (
        <div className="wiki-sidebar-section">
          <p className="wiki-sidebar-heading">Directories</p>
          {sortedDirs.map(dir => {
            const dirArticles = articles.filter(a => a.directory === dir);
            const isOpen = expanded[dir] !== false;
            return (
              <div key={dir}>
                <button className="wiki-sidebar-dir-btn" onClick={() => toggle(dir)}>
                  <span>
                    <span style={{ marginRight: 4 }}>{DIRECTORY_ICONS[dir] || '📄'}</span>
                    <span style={{ textTransform: 'capitalize' }}>{dir}</span>
                    <span style={{ color: '#54595d', fontWeight: 400, marginLeft: 4, fontSize: 11 }}>
                      ({dirArticles.length})
                    </span>
                  </span>
                  <span style={{ fontSize: 10, color: '#54595d' }}>{isOpen ? '▾' : '▸'}</span>
                </button>

                {isOpen && (
                  <div className="wiki-sidebar-dir-children">
                    {dirArticles.slice(0, 15).map(a => (
                      <Link
                        key={a.slug}
                        to={`/wiki/${a.slug}`}
                        className="wiki-sidebar-link"
                        style={location.pathname === `/wiki/${a.slug}` ? { fontWeight: 700, color: '#202122' } : {}}
                      >
                        {a.title}
                      </Link>
                    ))}
                    {dirArticles.length > 15 && (
                      <Link to={`/directory/${dir}`} className="wiki-sidebar-link" style={{ fontStyle: 'italic', color: '#54595d' }}>
                        {dirArticles.length - 15} more…
                      </Link>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {sortedDirs.length === 0 && !isLoading && (
        <div className="wiki-sidebar-section">
          <p style={{ fontSize: 12, color: '#54595d', fontStyle: 'italic', margin: 0 }}>
            No articles yet.<br />Upload data to begin.
          </p>
        </div>
      )}
    </nav>
  );
}
