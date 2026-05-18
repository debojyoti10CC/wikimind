import { useRef, useState } from 'react';

export default function UploadZone({ onFiles }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = (fileList) => {
    const files = Array.from(fileList);
    if (!files.length) return;
    const readers = files.map(file => new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = e => resolve({ name: file.name, content: e.target.result });
      reader.onerror = () => resolve({ name: file.name, content: '', error: true });
      reader.readAsText(file);
    }));
    Promise.all(readers).then(results => onFiles(results.filter(r => !r.error && r.content)));
  };

  return (
    <div
      className={`wiki-upload-zone${dragging ? ' dragging' : ''}`}
      onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".txt,.md,.json,.html,.csv"
        style={{ display: 'none' }}
        onChange={e => handleFiles(e.target.files)}
      />

      <div style={{ fontSize: 36, marginBottom: 8 }}>📂</div>
      <h2>Drop your personal data here</h2>
      <p>Accepts Day One JSON · Apple Notes HTML · Plain text / Markdown · iMessage CSV</p>

      <button
        className="wiki-btn"
        style={{ marginTop: 12, marginBottom: 16 }}
        onClick={e => { e.stopPropagation(); inputRef.current?.click(); }}
      >
        Choose files
      </button>

      <p style={{ fontSize: 12, color: '#54595d', marginTop: 8 }}>
        Your data never leaves your control — stored in your HydraDB tenant.
      </p>
    </div>
  );
}
