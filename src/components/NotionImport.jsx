import { useEffect, useState, useCallback, useRef } from 'react';
import {
  getNotionConnectionStatus,
  importNotionSource,
  importNotionPageById,
  startNotionOAuth,
  disconnectNotion,
  listNotionPages,
  listNotionDatabases,
} from '../api/notion';

// ─── Tab constants ─────────────────────────────────────────────────────────────
const TAB_URL = 'url';
const TAB_BROWSE = 'browse';

export default function NotionImport({ disabled, onEntries, onProgress }) {
  const [target, setTarget] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null); // null = loading
  const [activeTab, setActiveTab] = useState(TAB_URL);
  const [browseData, setBrowseData] = useState({ pages: [], databases: [], loading: false, error: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [showDisconnect, setShowDisconnect] = useState(false);
  const searchTimeout = useRef(null);

  // ── Fetch connection status on mount ──────────────────────────────────────
  const refreshStatus = useCallback(async () => {
    try {
      const s = await getNotionConnectionStatus();
      setStatus(s);
    } catch {
      setStatus({ configured: false, connected: false, workspace: '' });
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  // ── Handle OAuth flow ─────────────────────────────────────────────────────
  const handleConnect = async () => {
    try {
      await startNotionOAuth();
      // OAuth complete — refresh status
      await refreshStatus();
    } catch {
      onProgress?.('✗ Notion OAuth flow failed.');
    }
  };

  // ── Handle disconnect ─────────────────────────────────────────────────────
  const handleDisconnect = async () => {
    await disconnectNotion();
    setShowDisconnect(false);
    setSelectedItems(new Set());
    setBrowseData({ pages: [], databases: [], loading: false, error: '' });
    await refreshStatus();
  };

  // ── Import by URL/ID ──────────────────────────────────────────────────────
  const handleImportUrl = async () => {
    if (!target.trim() || loading || disabled) return;
    setLoading(true);
    try {
      onProgress?.('Importing from Notion…');
      const entries = await importNotionSource(target);
      onProgress?.(`Imported ${entries.length} Notion ${entries.length === 1 ? 'page' : 'pages'}.`);
      await onEntries(entries, 'Notion');
      setTarget('');
    } catch (err) {
      onProgress?.(`✗ Notion import failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ── Import selected pages from browse ─────────────────────────────────────
  const handleImportSelected = async () => {
    if (selectedItems.size === 0 || loading || disabled) return;
    setLoading(true);
    try {
      const ids = [...selectedItems];
      onProgress?.(`Importing ${ids.length} Notion page${ids.length === 1 ? '' : 's'}…`);
      const entries = [];
      for (const id of ids) {
        try {
          const entry = await importNotionPageById(id);
          entries.push(entry);
          onProgress?.(`  ✓ Imported: ${entry.source_filename}`);
        } catch (err) {
          onProgress?.(`  ✗ Failed page ${id}: ${err.message}`);
        }
      }
      if (entries.length > 0) {
        onProgress?.(`Imported ${entries.length} Notion page${entries.length === 1 ? '' : 's'}.`);
        await onEntries(entries, 'Notion');
      }
      setSelectedItems(new Set());
    } catch (err) {
      onProgress?.(`✗ Notion import failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ── Browse pages ──────────────────────────────────────────────────────────
  const loadBrowseData = useCallback(async (query = '') => {
    setBrowseData(prev => ({ ...prev, loading: true, error: '' }));
    try {
      const [pagesRes, dbRes] = await Promise.all([
        listNotionPages(query),
        query ? Promise.resolve({ databases: [] }) : listNotionDatabases(),
      ]);
      setBrowseData({
        pages: pagesRes.pages || [],
        databases: dbRes.databases || [],
        loading: false,
        error: '',
      });
    } catch (err) {
      setBrowseData(prev => ({ ...prev, loading: false, error: err.message }));
    }
  }, []);

  // Load browse data when switching to browse tab
  useEffect(() => {
    if (activeTab === TAB_BROWSE && status?.connected) {
      loadBrowseData();
    }
  }, [activeTab, status?.connected, loadBrowseData]);

  // Debounced search
  const handleSearch = (value) => {
    setSearchQuery(value);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      loadBrowseData(value);
    }, 400);
  };

  // ── Toggle page selection ─────────────────────────────────────────────────
  const toggleSelection = (id) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    const allIds = browseData.pages.map(p => p.id);
    setSelectedItems(new Set(allIds));
  };

  const deselectAll = () => {
    setSelectedItems(new Set());
  };

  // ── Time formatting ───────────────────────────────────────────────────────
  const formatDate = (iso) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      const now = new Date();
      const diff = now - d;
      if (diff < 60000) return 'just now';
      if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
      if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
      if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  // ── Loading state ─────────────────────────────────────────────────────────
  if (status === null) {
    return (
      <div className="notion-panel">
        <div className="notion-header">
          <div className="notion-header-left">
            <span className="notion-icon">📝</span>
            <span className="notion-header-title">Notion</span>
          </div>
          <span className="notion-status-badge notion-status-checking">Checking…</span>
        </div>
      </div>
    );
  }

  // ── Not configured at all ─────────────────────────────────────────────────
  if (!status.configured) {
    return (
      <div className="notion-panel">
        <div className="notion-header">
          <div className="notion-header-left">
            <span className="notion-icon">📝</span>
            <span className="notion-header-title">Import from Notion</span>
          </div>
          <span className="notion-status-badge notion-status-disconnected">Not configured</span>
        </div>
        <div className="notion-setup-guide">
          <p className="notion-setup-text">
            To connect Notion, add one of these to your <code>.env</code> file:
          </p>
          <div className="notion-setup-options">
            <div className="notion-setup-option">
              <span className="notion-setup-option-label">Quick setup</span>
              <code>NOTION_API_KEY=your_internal_integration_secret</code>
              <p className="notion-setup-option-help">
                Create at <a href="https://www.notion.so/my-integrations" target="_blank" rel="noopener noreferrer">notion.so/my-integrations</a>
              </p>
            </div>
            <div className="notion-setup-divider">or</div>
            <div className="notion-setup-option">
              <span className="notion-setup-option-label">OAuth (recommended)</span>
              <code>NOTION_CLIENT_ID=...</code>
              <code>NOTION_CLIENT_SECRET=...</code>
              <p className="notion-setup-option-help">
                Create a public integration for full OAuth flow
              </p>
            </div>
          </div>
          <p className="notion-setup-restart">Restart <code>npm run dev</code> after updating .env</p>
        </div>
      </div>
    );
  }

  // ── Main connected / ready-to-connect UI ──────────────────────────────────
  return (
    <div className="notion-panel">
      {/* Header */}
      <div className="notion-header">
        <div className="notion-header-left">
          <span className="notion-icon">📝</span>
          <span className="notion-header-title">Notion</span>
          {status.connected && status.workspace && (
            <span className="notion-workspace-name">{status.workspace}</span>
          )}
        </div>
        <div className="notion-header-right">
          {status.connected ? (
            <div className="notion-connected-actions">
              <span className="notion-status-badge notion-status-connected">
                <span className="notion-status-dot"></span>
                Connected
                {status.connectionMode === 'api_key' ? ' (API key)' : ''}
              </span>
              <button
                className="notion-disconnect-btn"
                onClick={() => setShowDisconnect(!showDisconnect)}
                title="Connection settings"
              >
                ⚙
              </button>
            </div>
          ) : (
            <button
              className="wiki-btn notion-connect-btn"
              onClick={handleConnect}
              disabled={!status.oauthConfigured && !status.apiKeyConfigured}
            >
              <span className="notion-connect-icon">🔗</span>
              Connect Notion
            </button>
          )}
        </div>
      </div>

      {/* Disconnect confirmation */}
      {showDisconnect && (
        <div className="notion-disconnect-confirm">
          <p>Disconnect from Notion? You can reconnect anytime.</p>
          <div className="notion-disconnect-actions">
            <button className="wiki-btn notion-disconnect-yes" onClick={handleDisconnect}>
              Disconnect
            </button>
            <button className="wiki-btn wiki-btn-secondary" onClick={() => setShowDisconnect(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Connected content */}
      {status.connected && !showDisconnect && (
        <div className="notion-content">
          {/* Tabs */}
          <div className="notion-tabs">
            <button
              className={`notion-tab ${activeTab === TAB_URL ? 'notion-tab-active' : ''}`}
              onClick={() => setActiveTab(TAB_URL)}
            >
              Paste URL / ID
            </button>
            <button
              className={`notion-tab ${activeTab === TAB_BROWSE ? 'notion-tab-active' : ''}`}
              onClick={() => setActiveTab(TAB_BROWSE)}
            >
              Browse Pages
            </button>
          </div>

          {/* URL/ID Tab */}
          {activeTab === TAB_URL && (
            <div className="notion-url-tab">
              <div className="notion-input-row">
                <input
                  value={target}
                  onChange={e => setTarget(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleImportUrl(); }}
                  placeholder="Page URL, page ID, or database:<id>"
                  disabled={loading || disabled}
                  className="notion-input"
                />
                <button
                  className="wiki-btn notion-import-btn"
                  onClick={handleImportUrl}
                  disabled={loading || disabled || !target.trim()}
                >
                  {loading ? 'Importing…' : 'Import'}
                </button>
              </div>
              <p className="notion-url-help">
                Paste a Notion page URL, a 32-character page ID, or use <code>database:&lt;id&gt;</code> to import all pages from a database.
              </p>
            </div>
          )}

          {/* Browse Tab */}
          {activeTab === TAB_BROWSE && (
            <div className="notion-browse-tab">
              {/* Search */}
              <div className="notion-browse-search">
                <span className="notion-browse-search-icon">🔍</span>
                <input
                  value={searchQuery}
                  onChange={e => handleSearch(e.target.value)}
                  placeholder="Search your Notion pages…"
                  disabled={loading || disabled}
                  className="notion-browse-search-input"
                />
              </div>

              {/* Databases */}
              {browseData.databases.length > 0 && !searchQuery && (
                <div className="notion-browse-section">
                  <p className="notion-browse-section-title">Databases</p>
                  {browseData.databases.map(db => (
                    <button
                      key={db.id}
                      className="notion-browse-item notion-browse-db"
                      onClick={() => {
                        setTarget(`database:${db.id}`);
                        setActiveTab(TAB_URL);
                      }}
                    >
                      <span className="notion-browse-item-icon">{db.icon || '🗄️'}</span>
                      <span className="notion-browse-item-info">
                        <span className="notion-browse-item-title">{db.title || 'Untitled'}</span>
                        {db.lastEdited && (
                          <span className="notion-browse-item-date">{formatDate(db.lastEdited)}</span>
                        )}
                      </span>
                      <span className="notion-browse-item-action">Import all →</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Pages */}
              {browseData.loading ? (
                <div className="notion-browse-loading">
                  <span className="notion-spinner"></span>
                  Loading pages…
                </div>
              ) : browseData.error ? (
                <div className="notion-browse-error">
                  ✗ {browseData.error}
                </div>
              ) : browseData.pages.length === 0 ? (
                <div className="notion-browse-empty">
                  {searchQuery
                    ? 'No pages match your search.'
                    : 'No pages found. Make sure pages are shared with your integration.'}
                </div>
              ) : (
                <>
                  <div className="notion-browse-toolbar">
                    <span className="notion-browse-count">
                      {browseData.pages.length} page{browseData.pages.length !== 1 ? 's' : ''}
                      {selectedItems.size > 0 && ` · ${selectedItems.size} selected`}
                    </span>
                    <div className="notion-browse-toolbar-actions">
                      {selectedItems.size < browseData.pages.length ? (
                        <button className="notion-browse-toolbar-btn" onClick={selectAll}>Select all</button>
                      ) : (
                        <button className="notion-browse-toolbar-btn" onClick={deselectAll}>Deselect all</button>
                      )}
                    </div>
                  </div>

                  <div className="notion-browse-list">
                    {browseData.pages.map(page => (
                      <label
                        key={page.id}
                        className={`notion-browse-item notion-browse-page ${selectedItems.has(page.id) ? 'notion-browse-item-selected' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedItems.has(page.id)}
                          onChange={() => toggleSelection(page.id)}
                          className="notion-browse-checkbox"
                        />
                        <span className="notion-browse-item-icon">{page.icon || '📄'}</span>
                        <span className="notion-browse-item-info">
                          <span className="notion-browse-item-title">{page.title || 'Untitled'}</span>
                          {page.lastEdited && (
                            <span className="notion-browse-item-date">{formatDate(page.lastEdited)}</span>
                          )}
                        </span>
                      </label>
                    ))}
                  </div>

                  {selectedItems.size > 0 && (
                    <div className="notion-browse-import-bar">
                      <button
                        className="wiki-btn notion-browse-import-btn"
                        onClick={handleImportSelected}
                        disabled={loading || disabled}
                      >
                        {loading
                          ? 'Importing…'
                          : `Import ${selectedItems.size} page${selectedItems.size !== 1 ? 's' : ''}`}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Not connected + has OAuth configured */}
      {!status.connected && (
        <div className="notion-connect-prompt">
          <p className="notion-connect-text">
            Connect your Notion workspace to import pages and databases directly into your wiki.
          </p>
          {!status.oauthConfigured && status.apiKeyConfigured && (
            <p className="notion-connect-hint">
              Your API key couldn't be validated. Check that it's correct in <code>.env</code> and restart the dev server.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
