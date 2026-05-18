import { useMemo, useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useWiki } from '../context/useWiki';

export default function TopBar() {
  const { articles } = useWiki();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const ref = useRef(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return articles
      .filter(a =>
        (a.title || '').toLowerCase().includes(q) ||
        (a.summary || '').toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [query, articles]);

  const showResults = open && results.length > 0;

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const go = (slug) => {
    setQuery('');
    setOpen(false);
    navigate(`/wiki/${slug}`);
  };

  return (
    <header className="wiki-topbar">
      <Link to="/" className="wiki-topbar-logo">
        Wiki<span>Mind</span>
      </Link>

      {/* Search */}
      <div className="wiki-topbar-search" ref={ref}>
        <span className="search-icon">🔍</span>
        <input
          type="text"
          placeholder="Search your wiki…"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={e => {
            if (e.key === 'Enter' && results.length > 0) go(results[0].slug);
            if (e.key === 'Escape') setOpen(false);
          }}
        />
        {showResults && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: 'white',
            border: '1px solid #a2a9b1',
            borderTop: 'none',
            zIndex: 200,
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          }}>
            {results.map(a => (
              <button
                key={a.slug}
                onClick={() => go(a.slug)}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '7px 12px',
                  textAlign: 'left',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '13px',
                  borderBottom: '1px solid #eaecf0',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#f0f4ff'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <span style={{ color: '#3366cc' }}>{a.title}</span>
                <span style={{ color: '#54595d', marginLeft: 8, fontSize: 11, textTransform: 'capitalize' }}>
                  {a.directory}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <nav className="wiki-topbar-nav">
        <Link to="/">Home</Link>
        <Link to="/graph">Graph</Link>
        <Link to="/ask">Ask</Link>
      </nav>
    </header>
  );
}
