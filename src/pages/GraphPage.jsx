import TopBar from '../components/TopBar';
import KnowledgeGraph from '../components/KnowledgeGraph';

export default function GraphPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <TopBar />
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <KnowledgeGraph />
      </div>
    </div>
  );
}
