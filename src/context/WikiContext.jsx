import { useReducer, useEffect, useCallback } from 'react';
import { listAllArticles } from '../api/hydradb';
import { buildBacklinks } from '../lib/wikilinks';
import { buildGraphData } from '../lib/graph';
import { WikiContext } from './wikiContext';

// ─── Initial State ────────────────────────────────────────────────────────────

const initialState = {
  articles: [],
  directories: {},
  isAbsorbing: false,
  absorptionProgress: [],
  absorptionStats: { total: 0, processed: 0, created: 0, updated: 0 },
  currentArticle: null,
  graphData: { nodes: [], links: [] },
  backlinks: {},
  isLoading: false,
  loadError: null,
};

// ─── Reducer ──────────────────────────────────────────────────────────────────

function wikiReducer(state, action) {
  switch (action.type) {
    case 'LOAD_START':
      return { ...state, isLoading: true, loadError: null };

    case 'LOAD_ARTICLES': {
      const articles = action.payload;
      const directories = {};
      articles.forEach(a => {
        const dir = a.directory || 'misc';
        if (!directories[dir]) directories[dir] = [];
        directories[dir].push(a.slug);
      });
      const backlinks = buildBacklinks(articles);
      const graphData = buildGraphData(articles, backlinks);
      return {
        ...state,
        articles,
        directories,
        backlinks,
        graphData,
        isLoading: false,
        loadError: null,
      };
    }

    case 'LOAD_ERROR':
      return { ...state, isLoading: false, loadError: action.payload };

    case 'SET_ABSORBING':
      return {
        ...state,
        isAbsorbing: action.payload,
        absorptionProgress: action.payload ? [] : state.absorptionProgress,
        absorptionStats: action.payload
          ? { total: 0, processed: 0, created: 0, updated: 0 }
          : state.absorptionStats,
      };

    case 'ADD_PROGRESS':
      return {
        ...state,
        absorptionProgress: [...state.absorptionProgress, action.payload],
      };

    case 'SET_STATS':
      return { ...state, absorptionStats: action.payload };

    case 'SET_ARTICLE':
      return { ...state, currentArticle: action.payload };

    case 'REFRESH_GRAPH': {
      const backlinks = buildBacklinks(state.articles);
      const graphData = buildGraphData(state.articles, backlinks);
      return { ...state, backlinks, graphData };
    }

    default:
      return state;
  }
}

export function WikiProvider({ children }) {
  const [state, dispatch] = useReducer(wikiReducer, initialState);

  const loadArticles = useCallback(async () => {
    dispatch({ type: 'LOAD_START' });
    try {
      const data = await listAllArticles();
      // listAllArticles returns { results: [...] }
      const raw = data?.results || [];
      const articles = raw.map(item => ({
        slug:       item.metadata?.slug || item.id || '',
        title:      item.metadata?.title || 'Untitled',
        directory:  item.metadata?.directory || 'misc',
        summary:    item.metadata?.summary || '',
        wikilinks:  item.metadata?.wikilinks || [],
        version:    item.metadata?.version || 1,
        updated_at: item.metadata?.updated_at || '',
        created_at: item.metadata?.created_at || '',
        word_count: item.metadata?.word_count || 0,
        version_history: item.metadata?.version_history || [],
        source_entries:  item.metadata?.source_entries || [],
        content: null, // lazy-loaded on article page
      })).filter(a => a.slug);
      dispatch({ type: 'LOAD_ARTICLES', payload: articles });
    } catch (err) {
      dispatch({ type: 'LOAD_ERROR', payload: err.message });
    }
  }, []);

  // Load on mount
  useEffect(() => {
    loadArticles();
  }, [loadArticles]);

  const addProgress = useCallback((msg) => {
    dispatch({ type: 'ADD_PROGRESS', payload: msg });
  }, []);

  const setStats = useCallback((stats) => {
    dispatch({ type: 'SET_STATS', payload: stats });
  }, []);

  const setAbsorbing = useCallback((val) => {
    dispatch({ type: 'SET_ABSORBING', payload: val });
  }, []);

  const setCurrentArticle = useCallback((article) => {
    dispatch({ type: 'SET_ARTICLE', payload: article });
  }, []);

  return (
    <WikiContext.Provider value={{
      ...state,
      loadArticles,
      addProgress,
      setStats,
      setAbsorbing,
      setCurrentArticle,
      dispatch,
    }}>
      {children}
    </WikiContext.Provider>
  );
}
