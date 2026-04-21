import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { indexRepo, uploadZip } from '../api/client';

export default function IndexPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('github');
  const [githubUrl, setGithubUrl] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleIndex() {
    setError('');
    setLoading(true);
    try {
      let result;
      if (tab === 'github') {
        if (!githubUrl.trim()) {
          setError('Please enter a GitHub URL.');
          setLoading(false);
          return;
        }
        result = await indexRepo(githubUrl.trim());
      } else {
        if (!file) {
          setError('Please select a zip file.');
          setLoading(false);
          return;
        }
        result = await uploadZip(file);
      }
      localStorage.setItem('session_id', result.session_id);
      localStorage.setItem('indexed_count', result.indexed);
      navigate('/search');
    } catch (err) {
      setError(err.response?.data?.detail || 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 6 }}>
          Semantic Code Search
        </h1>
        <p style={{ fontSize: 14, color: '#6b6a65' }}>
          Search any codebase with natural language
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button
          className={tab === 'github' ? 'ghost' : 'ghost'}
          onClick={() => setTab('github')}
          style={{
            borderColor: tab === 'github' ? '#7F77DD' : '#d0cec7',
            color: tab === 'github' ? '#534AB7' : '#6b6a65',
            fontWeight: tab === 'github' ? 600 : 400,
          }}
        >
          GitHub URL
        </button>
        <button
          className="ghost"
          onClick={() => setTab('upload')}
          style={{
            borderColor: tab === 'upload' ? '#7F77DD' : '#d0cec7',
            color: tab === 'upload' ? '#534AB7' : '#6b6a65',
            fontWeight: tab === 'upload' ? 600 : 400,
          }}
        >
          Upload zip
        </button>
      </div>

      {tab === 'github' ? (
        <input
          type="text"
          placeholder="https://github.com/username/repo"
          value={githubUrl}
          onChange={e => setGithubUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleIndex()}
          style={{ marginBottom: 14 }}
        />
      ) : (
        <div style={{ marginBottom: 14 }}>
          <input
            type="file"
            accept=".zip"
            onChange={e => setFile(e.target.files[0])}
            style={{
              width: '100%',
              padding: '10px 14px',
              border: '0.5px solid #d0cec7',
              borderRadius: 8,
              background: '#fafaf8',
              cursor: 'pointer',
            }}
          />
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button
          className="primary"
          onClick={handleIndex}
          disabled={loading}
        >
          {loading ? 'Indexing...' : 'Index repository'}
        </button>
        {!loading && (
          <span style={{ fontSize: 12, color: '#9b9a95' }}>
            ~30s for avg repo
          </span>
        )}
        {loading && (
          <span style={{ fontSize: 13, color: '#6b6a65' }}>
            Cloning and indexing repository...
          </span>
        )}
      </div>

      {error && (
        <p style={{ fontSize: 13, color: '#A32D2D', marginTop: 8 }}>
          {error}
        </p>
      )}
    </div>
  );
}