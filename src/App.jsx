import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { WikiProvider } from './context/WikiContext';
import Home from './pages/Home';
import ArticlePage from './pages/ArticlePage';
import GraphPage from './pages/GraphPage';
import DirectoryPage from './pages/DirectoryPage';
import QueryPage from './pages/QueryPage';

export default function App() {
  return (
    <WikiProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/"                  element={<Home />} />
          <Route path="/wiki/:slug"        element={<ArticlePage />} />
          <Route path="/graph"             element={<GraphPage />} />
          <Route path="/directory/:name"   element={<DirectoryPage />} />
          <Route path="/ask"               element={<QueryPage />} />
        </Routes>
      </BrowserRouter>
    </WikiProvider>
  );
}
