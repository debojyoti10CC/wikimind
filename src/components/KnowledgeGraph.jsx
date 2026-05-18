import { useMemo, useRef, useCallback, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { useNavigate } from 'react-router-dom';
import { useWiki } from '../context/useWiki';
import { DIRECTORY_COLORS, DIRECTORY_ICONS } from '../lib/graph';

export default function KnowledgeGraph() {
  const { graphData } = useWiki();
  const navigate = useNavigate();
  const fgRef = useRef();
  const [search, setSearch] = useState('');
  const [tooltip, setTooltip] = useState(null);

  const handleNodeClick = useCallback((node) => {
    navigate(`/wiki/${node.id}`);
  }, [navigate]);

  const handleNodeHover = useCallback((node) => {
    setTooltip(node ? { label: node.label, summary: node.summary, directory: node.directory } : null);
  }, []);

  const highlightedNodes = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return null;
    return new Set(
      graphData.nodes
        .filter(n => n.label?.toLowerCase().includes(q))
        .map(n => n.id)
    );
  }, [graphData.nodes, search]);

  const paintNode = useCallback((node, ctx, globalScale) => {
    const isHighlighted = !highlightedNodes || highlightedNodes.has(node.id);
    const radius = Math.sqrt(node.val || 1) * 4;
    const label = node.label || '';
    const fontSize = Math.max(10, 12 / globalScale);

    // Node circle
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = isHighlighted
      ? (node.color || '#6b7280')
      : 'rgba(150,150,150,0.2)';
    ctx.fill();

    // Label
    if (globalScale > 0.6 || highlightedNodes?.has(node.id)) {
      ctx.font = `${fontSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = isHighlighted ? '#202122' : 'rgba(150,150,150,0.4)';
      ctx.fillText(label, node.x, node.y + radius + 2);
    }
  }, [highlightedNodes]);

  return (
    <div className="wiki-graph-shell">
      {/* Search */}
      <div className="wiki-graph-search">
        <input
          type="text"
          placeholder="Highlight nodes…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div className="wiki-graph-tooltip">
          <p className="wiki-graph-tooltip-title">{tooltip.label}</p>
          <p className="wiki-graph-tooltip-meta">
            {DIRECTORY_ICONS[tooltip.directory] || '📄'} {tooltip.directory}
          </p>
          {tooltip.summary && (
            <p className="wiki-graph-tooltip-summary">{tooltip.summary}</p>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="wiki-graph-legend">
        <p>Legend</p>
        <div>
          {Object.entries(DIRECTORY_COLORS).map(([dir, color]) => (
            <div key={dir} className="wiki-graph-legend-row">
              <span style={{ backgroundColor: color }} />
              <strong>{dir}</strong>
            </div>
          ))}
        </div>
      </div>

      {/* Graph */}
      {graphData.nodes.length === 0 ? (
        <div className="wiki-graph-empty">
          No articles yet. Upload data to build your knowledge graph.
        </div>
      ) : (
        <ForceGraph2D
          ref={fgRef}
          graphData={graphData}
          nodeCanvasObject={paintNode}
          nodeCanvasObjectMode={() => 'replace'}
          linkColor={link => link.color || 'rgba(150,150,150,0.3)'}
          linkWidth={1}
          onNodeClick={handleNodeClick}
          onNodeHover={handleNodeHover}
          nodeLabel=""
          cooldownTicks={100}
          d3AlphaDecay={0.02}
          d3VelocityDecay={0.3}
        />
      )}
    </div>
  );
}
