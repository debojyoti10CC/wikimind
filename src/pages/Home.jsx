import { Link } from 'react-router-dom';
import { useWiki } from '../context/useWiki';
import TopBar from '../components/TopBar';
import Sidebar from '../components/Sidebar';
import UploadZone from '../components/UploadZone';
import ProgressLog from '../components/ProgressLog';
import { parseFile } from '../lib/parsers';
import { runAbsorptionPipeline } from '../lib/pipeline';
import { DIRECTORY_ICONS } from '../lib/graph';

export default function Home() {
  const {
    isAbsorbing, absorptionProgress,
    setAbsorbing, addProgress, setStats,
    loadArticles, articles, directories, loadError,
  } = useWiki();

  const handleFiles = async (fileResults) => {
    if (isAbsorbing) return;
    const allEntries = [];
    for (const { name, content } of fileResults) {
      try {
        const entries = parseFile(name, content);
        entries.forEach(e => { e.source_filename = name; });
        allEntries.push(...entries);
      } catch (err) {
        addProgress(`✗ Failed to parse ${name}: ${err.message}`);
      }
    }
    if (!allEntries.length) { addProgress('No entries found in the uploaded files.'); return; }
    addProgress(`Parsed ${allEntries.length} entries from ${fileResults.length} file(s). Starting absorption…`);
    setAbsorbing(true);
    try {
      await runAbsorptionPipeline(allEntries, addProgress, setStats);
      await loadArticles();
    } catch (err) {
      addProgress(`✗ Pipeline error: ${err.message}`);
    } finally {
      setAbsorbing(false);
    }
  };

  const showProgress = isAbsorbing || absorptionProgress.length > 0;
  const sortedDirs = Object.keys(directories).sort();

  return (
    <>
      <TopBar />
      <div className="wiki-layout">
        <Sidebar />

        <main className="wiki-main" style={{ maxWidth: 'none', flex: 1 }}>
          {/* Hero */}
          <div className="wiki-home-hero">
            <h1 className="wiki-home-title">WikiMind Personal</h1>
            <p className="wiki-home-tagline">Feed it your life. Get your Wikipedia.</p>
          </div>

          {loadError && (
            <div style={{
              maxWidth: 680,
              marginBottom: 20,
              padding: '12px 16px',
              background: '#fff0f0',
              border: '1px solid #f8c8c8',
              borderRadius: 2,
              color: '#ba0000',
              fontSize: 13,
            }}>
              <strong>HydraDB is not connected:</strong> {loadError}
            </div>
          )}

          {/* Two-column layout when wiki has content */}
          {articles.length > 0 && !showProgress ? (
            <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start' }}>
              {/* Left: welcome + upload */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  background: '#f0f4ff',
                  border: '1px solid #c8d8f8',
                  borderRadius: 2,
                  padding: '14px 18px',
                  marginBottom: 24,
                  fontSize: 13,
                }}>
                  <p style={{ margin: '0 0 6px', fontFamily: 'Georgia, serif', fontSize: 14 }}>
                    Your wiki has <strong>{articles.length} articles</strong> across{' '}
                    <strong>{sortedDirs.length} {sortedDirs.length === 1 ? 'directory' : 'directories'}</strong>.
                    Upload more data to expand it.
                  </p>
                  <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                    <Link to="/graph" className="wiki-btn" style={{ fontSize: 12, padding: '4px 12px' }}>
                      Explore graph
                    </Link>
                    <Link to="/ask" className="wiki-btn wiki-btn-secondary" style={{ fontSize: 12, padding: '4px 12px' }}>
                      Ask your wiki
                    </Link>
                  </div>
                </div>

                <UploadZone onFiles={handleFiles} />
              </div>

              {/* Right: directory index */}
              <div style={{ width: 260, flexShrink: 0 }}>
                <div style={{
                  border: '1px solid #a2a9b1',
                  borderRadius: 2,
                  overflow: 'hidden',
                }}>
                  <div style={{
                    background: '#eaecf0',
                    padding: '8px 14px',
                    fontFamily: 'Georgia, serif',
                    fontSize: 14,
                    fontWeight: 600,
                    borderBottom: '1px solid #a2a9b1',
                  }}>
                    Contents
                  </div>
                  <div style={{ padding: '10px 14px' }}>
                    {sortedDirs.map((dir, i) => {
                      const count = (directories[dir] || []).length;
                      return (
                        <div key={dir} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <Link
                            to={`/directory/${dir}`}
                            style={{ color: '#3366cc', textDecoration: 'none', fontSize: 13 }}
                            onMouseEnter={e => e.target.style.textDecoration = 'underline'}
                            onMouseLeave={e => e.target.style.textDecoration = 'none'}
                          >
                            <span style={{ marginRight: 6 }}>{i + 1}.</span>
                            {DIRECTORY_ICONS[dir] || '📄'} <span style={{ textTransform: 'capitalize' }}>{dir}</span>
                          </Link>
                          <span style={{ fontSize: 12, color: '#54595d' }}>{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Recent articles */}
                <div style={{ marginTop: 16 }}>
                  <p style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: '#54595d',
                    margin: '0 0 8px',
                    paddingBottom: 4,
                    borderBottom: '1px solid #eaecf0',
                  }}>
                    Recent articles
                  </p>
                  {[...articles]
                    .sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''))
                    .slice(0, 8)
                    .map(a => (
                      <Link
                        key={a.slug}
                        to={`/wiki/${a.slug}`}
                        style={{ display: 'block', fontSize: 13, color: '#3366cc', textDecoration: 'none', marginBottom: 4 }}
                        onMouseEnter={e => e.target.style.textDecoration = 'underline'}
                        onMouseLeave={e => e.target.style.textDecoration = 'none'}
                      >
                        {DIRECTORY_ICONS[a.directory] || '📄'} {a.title}
                      </Link>
                    ))}
                </div>
              </div>
            </div>
          ) : !showProgress ? (
            /* Empty state */
            <div style={{ maxWidth: 600 }}>
              <UploadZone onFiles={handleFiles} />
              <div style={{
                marginTop: 20,
                padding: '12px 16px',
                background: '#f0f4ff',
                border: '1px solid #c8d8f8',
                borderRadius: 2,
                fontSize: 13,
              }}>
                <strong>Quick start:</strong> Upload the included{' '}
                <code style={{ background: '#dce8ff', padding: '1px 4px', borderRadius: 2 }}>sample_diary.txt</code>{' '}
                to see the pipeline in action. It contains 9 dated entries about people, projects, and places.
              </div>
            </div>
          ) : null}

          {/* Progress */}
          {showProgress && (
            <div style={{ maxWidth: 680 }}>
              <h2 style={{
                fontFamily: 'Georgia, serif',
                fontSize: 18,
                fontWeight: 400,
                margin: '0 0 16px',
                paddingBottom: 6,
                borderBottom: '1px solid #eaecf0',
              }}>
                {isAbsorbing ? '⚙️ Absorbing your data…' : '✅ Absorption complete'}
              </h2>
              <ProgressLog />
              {!isAbsorbing && (
                <div style={{ marginTop: 20 }}>
                  <UploadZone onFiles={handleFiles} />
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </>
  );
}
