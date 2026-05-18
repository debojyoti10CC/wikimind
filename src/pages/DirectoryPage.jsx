import { useParams, Link } from 'react-router-dom';
import { useWiki } from '../context/useWiki';
import TopBar from '../components/TopBar';
import Sidebar from '../components/Sidebar';
import { DIRECTORY_ICONS } from '../lib/graph';

export default function DirectoryPage() {
  const { name } = useParams();
  const { articles } = useWiki();

  const dirArticles = [...articles]
    .filter(a => a.directory === name)
    .sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));

  const icon = DIRECTORY_ICONS[name] || '📄';

  return (
    <>
      <TopBar />
      <div className="wiki-layout">
        <Sidebar />
        <main className="wiki-main">
          {/* Breadcrumb */}
          <div style={{ fontSize: 12, color: '#54595d', marginBottom: 16 }}>
            <Link to="/" style={{ color: '#3366cc', textDecoration: 'none' }}>Main page</Link>
            {' › '}
            <span style={{ textTransform: 'capitalize' }}>{name}</span>
          </div>

          {/* Title */}
          <h1 className="wiki-article-title" style={{ textTransform: 'capitalize' }}>
            {icon} {name}
          </h1>
          <p style={{ fontSize: 13, color: '#54595d', margin: '0 0 24px' }}>
            {dirArticles.length} article{dirArticles.length !== 1 ? 's' : ''} in this directory
          </p>

          {/* Grid */}
          {dirArticles.length === 0 ? (
            <p style={{ fontSize: 13, color: '#54595d', fontStyle: 'italic' }}>
              No articles in this directory yet.
            </p>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 12,
            }}>
              {dirArticles.map(article => (
                <Link
                  key={article.slug}
                  to={`/wiki/${article.slug}`}
                  className="wiki-article-card"
                >
                  <h3>{icon} {article.title}</h3>
                  {article.summary && <p>{article.summary}</p>}
                  <div className="meta">
                    <span>v{article.version}</span>
                    {article.updated_at && (
                      <span>{new Date(article.updated_at).toLocaleDateString()}</span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </main>
      </div>
    </>
  );
}
