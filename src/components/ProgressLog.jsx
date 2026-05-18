import { useEffect, useRef } from 'react';
import { useWiki } from '../context/useWiki';

function classify(line) {
  if (line.startsWith('✅') || line.startsWith('✓')) return 't-done';
  if (line.startsWith('✗') || line.includes('Error') || line.includes('Failed')) return 't-err';
  if (line.startsWith('  + Creating')) return 't-new';
  if (line.startsWith('  ↻ Updating')) return 't-upd';
  if (line.startsWith('  ✓')) return 't-ok';
  if (line.startsWith('  ⏱') || line.startsWith('  ⏳')) return 't-wait';
  if (line.startsWith('—')) return 't-check';
  return '';
}

export default function ProgressLog() {
  const { absorptionProgress, absorptionStats, isAbsorbing } = useWiki();
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [absorptionProgress]);

  const { total, processed, created, updated } = absorptionStats;
  const pct = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0;

  return (
    <div>
      {/* Stats */}
      <div className="wiki-stats-bar">
        <span><strong>{processed}</strong>/{total} entries</span>
        <span style={{ color: '#a6e3a1' }}><strong>{created}</strong> created</span>
        <span style={{ color: '#89b4fa' }}><strong>{updated}</strong> updated</span>
        {isAbsorbing && (
          <span style={{ color: '#3366cc', fontStyle: 'italic' }}>● Processing…</span>
        )}
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div style={{ height: 3, background: '#eaecf0', borderRadius: 2, marginBottom: 12 }}>
          <div style={{
            height: '100%',
            width: `${pct}%`,
            background: '#3366cc',
            borderRadius: 2,
            transition: 'width 0.3s ease',
          }} />
        </div>
      )}

      {/* Terminal */}
      <div className="wiki-terminal">
        {absorptionProgress.length === 0 ? (
          <span style={{ color: '#6c7086', fontStyle: 'italic' }}>Waiting for data…</span>
        ) : (
          absorptionProgress.map((line, i) => (
            <div key={i} className={classify(line)}>{line}</div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
