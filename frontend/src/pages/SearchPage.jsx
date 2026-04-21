import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchCode, deleteSession } from '../api/client';
import ResultCard from '../components/ResultCard';

export default function SearchPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  const sessionId = localStorage.getItem('session_id');
  const indexedCount = localStorage.getItem('indexed_count');

  useEffect(() => {
    if (!sessionId) navigate('/');
  }, [sessionId, navigate]);

  // cleanup on tab close
  useEffect(() => {
    function handleUnload() {
      if (sessionId) {
        navigator.sendBeacon(
          `http://localhost:8000/session/${sessionId}`,
          JSON.stringify({})
        );
      }
    }
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [sessionId]);

  async function handleSearch() {
    if (!query.trim()) return;
    setError('');
    setLoading(true);
    setSearched(true);
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
    try {
      await deleteSession(sessionId);
    } catch (_) {}
    localStorage.removeItem('session_id');
    localStorage.removeItem('indexed_count');
    navigate('/');
  }

  return (
    <div className="page">
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
      }}>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7,
          fontSize: 13,
          fontWeight: 500,
          background: '#E1F5EE',
          color: '#0F6E56',
          padding: '5px 12px',
          borderRadius: 20,
        }}>
          <span style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: '#1D9E75',
            display: 'inline-block',
          }} />
          {indexedCount} chunks indexed
        </span>
        <button className="danger" onClick={handleExit}>
          Exit session
        </button>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
        <input
          type="text"
          placeholder="function that finds a pattern in text..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
        />
        <button
          className="primary"
          onClick={handleSearch}
          disabled={loading || !query.trim()}
          style={{ whiteSpace: 'nowrap' }}
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {error && (
        <p style={{ fontSize: 13, color: '#A32D2D', marginBottom: 16 }}>
          {error}
        </p>
      )}

      {searched && !loading && results.length === 0 && !error && (
        <p style={{ fontSize: 14, color: '#9b9a95', textAlign: 'center', marginTop: 40 }}>
          No results found. Try a different query.
        </p>
      )}

      {results.map((result, i) => (
        <ResultCard key={i} result={result} />
      ))}
    </div>
  );
}