import { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useWiki } from '../context/useWiki';
import { fetchArticleBySlug, recallSources, storeArticle } from '../api/hydradb';
import { createArticle } from '../api/gemini';
import { parseSummary, parseDirectory, cleanArticle, extractWikilinks, entityToSlug } from '../lib/pipeline';
import TopBar from '../components/TopBar';
import Sidebar from '../components/Sidebar';
import ArticleViewer from '../components/ArticleViewer';
import RelatedPanel from '../components/RelatedPanel';

export default function ArticlePage() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { articles, setCurrentArticle, loadArticles } = useWiki();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [article, setArticle] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [generateLog, setGenerateLog] = useState('');

  const missingName = searchParams.get('name');
  const isMissingPage = slug === 'missing';

  useEffect(() => {
    let cancelled = false;
    if (isMissingPage) {
      return () => { cancelled = true; };
    }

    const cached = articles.find(a => a.slug === slug);

    async function loadArticle() {
      setLoading(true);
      setError(null);
      setArticle(null);
      try {
        const full = await fetchArticleBySlug(slug);
        if (cancelled) return;
        if (full) {
          const loaded = {
            slug:            full.metadata?.slug || slug,
            title:           full.metadata?.title || 'Untitled',
            directory:       full.metadata?.directory || 'misc',
            summary:         full.metadata?.summary || '',
            wikilinks:       full.metadata?.wikilinks || [],
            version:         full.metadata?.version || 1,
            updated_at:      full.metadata?.updated_at || '',
            created_at:      full.metadata?.created_at || '',
            word_count:      full.metadata?.word_count || 0,
            version_history: full.metadata?.version_history || [],
            source_entries:  full.metadata?.source_entries || [],
            content:         full.content || '',
          };
          setCurrentArticle(loaded);
          setArticle(loaded);
        } else if (cached) {
          const loaded = { ...cached, content: cached.content || '' };
          setCurrentArticle(loaded);
          setArticle(loaded);
        } else {
          setError('not_found');
        }
      } catch (err) {
        if (cancelled) return;
        if (cached) {
          const loaded = { ...cached, content: cached.content || '' };
          setCurrentArticle(loaded);
          setArticle(loaded);
        } else {
          setError(err.message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadArticle();
    return () => { cancelled = true; };
  }, [articles, isMissingPage, setCurrentArticle, slug]);

  const handleGenerate = async () => {
    if (!missingName) return;
    setGenerating(true);
    setGenerateLog('Searching your data for mentions…');
    try {
      const recall = await recallSources(missingName);
      const sources = recall?.results || [];
      if (!sources.length) {
        setGenerateLog('No mentions found. Upload more entries first.');
        setGenerating(false);
        return;
      }
      setGenerateLog(`Found ${sources.length} mention(s). Generating article…`);
      const dir = 'people';
      const articleText = await createArticle(missingName, dir, sources.map(s => s.content || '').filter(Boolean));
      const summary   = parseSummary(articleText);
      const directory = parseDirectory(articleText, dir);
      const clean     = cleanArticle(articleText);
      const wikilinks = extractWikilinks(clean);
      const newSlug   = entityToSlug(directory, missingName);
      await storeArticle(newSlug, clean, {
        title: missingName, slug: newSlug, directory, version: 1,
        summary, wikilinks,
        source_entries: sources.map(s => s.metadata?.entry_id || ''),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        word_count: clean.split(/\s+/).length,
        version_history: [{ version: 1, updated_at: new Date().toISOString(), entries_added: sources.length }]
      });
      setGenerateLog('Article created! Redirecting…');
      await loadArticles();
      navigate(`/wiki/${newSlug}`);
    } catch (err) {
      setGenerateLog(`Error: ${err.message}`);
      setGenerating(false);
    }
  };

  // ── Missing article ───────────────────────────────────────────────────────
  if (isMissingPage) {
    const mentionCount = articles.filter(a =>
      (a.wikilinks || []).some(w => w.toLowerCase() === (missingName || '').toLowerCase())
    ).length;

    return (
      <>
        <TopBar />
        <div className="wiki-layout">
          <Sidebar />
          <main className="wiki-main">
            <div style={{
              border: '1px solid #a2a9b1',
              borderRadius: 2,
              padding: '32px 40px',
              maxWidth: 560,
              background: 'white',
            }}>
              <p style={{ fontSize: 13, color: '#54595d', margin: '0 0 8px' }}>
                This article does not exist yet.
              </p>
              <h1 style={{
                fontFamily: 'Georgia, serif',
                fontSize: 26,
                fontWeight: 400,
                margin: '0 0 16px',
                color: '#202122',
              }}>
                {missingName || 'Unknown'}
              </h1>
              {mentionCount > 0 && (
                <p style={{ fontSize: 13, color: '#54595d', margin: '0 0 20px' }}>
                  WikiMind found <strong>{mentionCount}</strong> mention{mentionCount !== 1 ? 's' : ''} of
                  "{missingName}" in your existing articles.
                </p>
              )}
              {generateLog && (
                <div style={{
                  fontFamily: 'monospace',
                  fontSize: 12,
                  background: '#f0f4ff',
                  border: '1px solid #c8d8f8',
                  borderRadius: 2,
                  padding: '8px 12px',
                  marginBottom: 16,
                  color: '#3366cc',
                }}>
                  {generateLog}
                </div>
              )}
              <button
                className="wiki-btn"
                onClick={handleGenerate}
                disabled={generating}
              >
                {generating ? 'Generating…' : 'Generate article from mentions →'}
              </button>
              <div style={{ marginTop: 16 }}>
                <Link to="/" style={{ fontSize: 13, color: '#3366cc' }}>← Main page</Link>
              </div>
            </div>
          </main>
        </div>
      </>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <>
        <TopBar />
        <div className="wiki-layout">
          <Sidebar />
          <main className="wiki-main">
            <div style={{ maxWidth: 640 }}>
              <div style={{ height: 32, background: '#eaecf0', borderRadius: 2, width: '40%', marginBottom: 12 }} />
              <div style={{ height: 14, background: '#f0f0f0', borderRadius: 2, width: '100%', marginBottom: 8 }} />
              <div style={{ height: 14, background: '#f0f0f0', borderRadius: 2, width: '85%', marginBottom: 8 }} />
              <div style={{ height: 14, background: '#f0f0f0', borderRadius: 2, width: '70%', marginBottom: 24 }} />
              <div style={{ height: 20, background: '#eaecf0', borderRadius: 2, width: '30%', marginBottom: 10 }} />
              <div style={{ height: 14, background: '#f0f0f0', borderRadius: 2, width: '100%', marginBottom: 8 }} />
              <div style={{ height: 14, background: '#f0f0f0', borderRadius: 2, width: '90%' }} />
            </div>
          </main>
        </div>
      </>
    );
  }

  // ── Not found ─────────────────────────────────────────────────────────────
  if (error === 'not_found' || !article) {
    return (
      <>
        <TopBar />
        <div className="wiki-layout">
          <Sidebar />
          <main className="wiki-main">
            <div style={{ border: '1px solid #a2a9b1', borderRadius: 2, padding: '32px 40px', maxWidth: 480 }}>
              <p style={{ fontSize: 13, color: '#54595d', margin: '0 0 8px' }}>Article not found</p>
              <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 24, fontWeight: 400, margin: '0 0 16px' }}>
                {slug}
              </h1>
              <Link to="/" style={{ fontSize: 13, color: '#3366cc' }}>← Main page</Link>
            </div>
          </main>
        </div>
      </>
    );
  }

  // ── Article ───────────────────────────────────────────────────────────────
  return (
    <>
      <TopBar />
      <div className="wiki-layout">
        <Sidebar />
        <main className="wiki-main">
          <ArticleViewer article={article} />
        </main>
        <RelatedPanel article={article} />
      </div>
    </>
  );
}
