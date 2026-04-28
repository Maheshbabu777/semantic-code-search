import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchCode, deleteSession } from '../api/client';
import ResultCard from '../components/ResultCard';

export default function SearchPage() {
  const navigate = useNavigate();
  const [query, setQuery]       = useState('');
  const [results, setResults]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [searched, setSearched] = useState(false);

  const sessionId    = localStorage.getItem('session_id');
  const indexedCount = localStorage.getItem('indexed_count');

  useEffect(() => {
    if (!sessionId) navigate('/');
  }, [sessionId, navigate]);

  useEffect(() => {
    if (!sessionId) return;

    function handleUnload() {
      fetch(`http://localhost:8000/session/${sessionId}`, {
        method:    'DELETE',
        keepalive: true,
      }).catch(() => {
      });
    }

    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [sessionId]);

  async function handleSearch() {
    if (!query.trim() || loading) return;
    setError('');
    setLoading(true);
    setSearched(true);
    setResults([]);
    try {
      const data = await searchCode(query.trim(), sessionId);
      setResults(data.results);
    } catch (err) {
      setError(err.response?.data?.detail || 'Search failed. Try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleExit() {
    try { await deleteSession(sessionId); } catch (_) {}
    localStorage.removeItem('session_id');
    localStorage.removeItem('indexed_count');
    navigate('/');
  }

  return (
    <div className="page page-enter">
      <div className="search-header">
        <span className="status-pill">
          <span className="status-dot" />
          {Number(indexedCount).toLocaleString()} chunks indexed
        </span>
        <button className="btn-exit" onClick={handleExit}>
          exit session
        </button>
      </div>

      <div className="search-row" style={{ marginBottom: 32 }}>
        <input
          type="text"
          placeholder="describe what you're looking for..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          autoFocus
        />
        <button
          className="btn-primary"
          onClick={handleSearch}
          disabled={loading || !query.trim()}
        >
          {loading ? 'searching...' : 'Search'}
        </button>
      </div>

      {error && <p className="error-msg">{error}</p>}

      {loading && (
        <div style={{ padding: '12px 0' }}>
          <div className="loading-bar-wrap">
            <div className="loading-bar" />
          </div>
        </div>
      )}

      {searched && !loading && results.length === 0 && !error && (
        <p className="empty-state">no results found — try rephrasing your query</p>
      )}

      {results.length > 0 && (
        <>
          <p style={{
            fontSize:    '0.75rem',
            color:       'var(--text-dim)',
            fontFamily:  'var(--font-mono)',
            marginBottom: 16,
            fontStyle:   'italic',
          }}>
            {results.length} result{results.length !== 1 ? 's' : ''} for "{query}"
          </p>
          {results.map((result, i) => (
            <ResultCard key={i} result={result} index={i} />
          ))}
        </>
      )}
    </div>
  );
}