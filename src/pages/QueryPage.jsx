import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useWiki } from '../context/useWiki';
import { answerQuery } from '../api/gemini';
import TopBar from '../components/TopBar';
import Sidebar from '../components/Sidebar';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const EXAMPLES = [
  'What patterns do I have around failure?',
  'Who are the most important people in my life?',
  'What projects have I abandoned and why?',
  'What ideas keep coming up in my writing?',
  'How have I changed over the past year?',
];

export default function QueryPage() {
  const { articles } = useWiki();
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const buildIndex = () =>
    articles.map(a =>
      `- [${a.directory}/${a.title}] (${a.slug}): ${a.summary || 'No summary'}`
    ).join('\n');

  const handleAsk = async () => {
    if (!question.trim() || loading) return;
    if (!articles.length) { setError('Your wiki is empty. Upload some data first.'); return; }
    setLoading(true); setError(''); setAnswer('');
    try {
      setAnswer(await answerQuery(question, buildIndex()));
    } catch (err) {
      setError(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <TopBar />
      <div className="wiki-layout">
        <Sidebar />
        <main className="wiki-main">
          {/* Breadcrumb */}
          <div style={{ fontSize: 12, color: '#54595d', marginBottom: 16 }}>
            <Link to="/" style={{ color: '#3366cc', textDecoration: 'none' }}>Main page</Link>
            {' › '}Ask your wiki
          </div>

          <h1 className="wiki-article-title">Ask your wiki</h1>
          <p style={{ fontSize: 13, color: '#54595d', margin: '0 0 24px', fontStyle: 'italic' }}>
            Ask anything about your life. Answers are grounded only in your wiki.
          </p>

          {/* Example chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            {EXAMPLES.map(q => (
              <button
                key={q}
                onClick={() => setQuestion(q)}
                style={{
                  fontSize: 12,
                  padding: '4px 10px',
                  background: 'white',
                  border: '1px solid #a2a9b1',
                  borderRadius: 2,
                  cursor: 'pointer',
                  color: '#3366cc',
                  fontFamily: 'inherit',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#3366cc'}
                onMouseLeave={e => e.currentTarget.style.borderColor = '#a2a9b1'}
              >
                {q}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="wiki-query-box" style={{ maxWidth: 640, marginBottom: 20 }}>
            <textarea
              value={question}
              onChange={e => setQuestion(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAsk(); }}
              placeholder="Your question…"
              rows={3}
            />
            <div className="wiki-query-footer">
              <span style={{ fontSize: 12, color: '#54595d' }}>
                {articles.length} articles · Cmd+Enter to ask
              </span>
              <button
                className="wiki-btn"
                onClick={handleAsk}
                disabled={loading || !question.trim()}
              >
                {loading ? 'Thinking…' : 'Ask →'}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              padding: '10px 14px',
              background: '#fff0f0',
              border: '1px solid #f8c8c8',
              borderRadius: 2,
              fontSize: 13,
              color: '#ba0000',
              marginBottom: 16,
              maxWidth: 640,
            }}>
              {error}
            </div>
          )}

          {/* Loading skeleton */}
          {loading && (
            <div style={{ maxWidth: 640 }}>
              {[100, 85, 90, 70].map((w, i) => (
                <div key={i} style={{
                  height: 14,
                  background: '#eaecf0',
                  borderRadius: 2,
                  width: `${w}%`,
                  marginBottom: 8,
                  animation: 'pulse 1.5s ease-in-out infinite',
                }} />
              ))}
            </div>
          )}

          {/* Answer */}
          {answer && (
            <div style={{
              maxWidth: 640,
              border: '1px solid #a2a9b1',
              borderRadius: 2,
              background: 'white',
              overflow: 'hidden',
            }}>
              <div style={{
                background: '#eaecf0',
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 600,
                borderBottom: '1px solid #a2a9b1',
                fontFamily: 'Georgia, serif',
              }}>
                Answer
              </div>
              <div style={{ padding: '16px 20px' }} className="wiki-article-body">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({ children }) => <p style={{ margin: '0 0 12px' }}>{children}</p>,
                    strong: ({ children }) => <strong>{children}</strong>,
                    ul: ({ children }) => <ul style={{ margin: '0 0 12px', paddingLeft: 20 }}>{children}</ul>,
                    li: ({ children }) => <li style={{ marginBottom: 4 }}>{children}</li>,
                    a: ({ href, children }) => (
                      <a href={href} style={{ color: '#3366cc' }}>{children}</a>
                    ),
                  }}
                >
                  {answer}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
