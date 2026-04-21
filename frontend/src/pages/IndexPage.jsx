import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { indexRepo, uploadZip } from '../api/client';

const LOADING_MESSAGES = [
  'Cloning repository...',
  'Walking the file tree...',
  'Chunking functions and methods...',
  'Generating semantic embeddings...',
  'Building vector index...',
  'Almost there...',
];

export default function IndexPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('github');
  const [githubUrl, setGithubUrl] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [msgIndex, setMsgIndex] = useState(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (loading) {
      setMsgIndex(0);
      intervalRef.current = setInterval(() => {
        setMsgIndex(i => (i + 1) % LOADING_MESSAGES.length);
      }, 2200);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [loading]);

  async function handleIndex() {
    setError('');
    if (tab === 'github' && !githubUrl.trim()) {
      setError('Please enter a GitHub URL.');
      return;
    }
    if (tab === 'upload' && !file) {
      setError('Please select a zip file.');
      return;
    }
    setLoading(true);
    try {
      let result;
      if (tab === 'github') {
        result = await indexRepo(githubUrl.trim());
      } else {
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
    <div className="page page-enter">
      <div className="index-header">
        <h1>Semantic<br /><span>Code Search</span></h1>
        <p className="subtitle">search any codebase with natural language</p>
      </div>

      {loading ? (
        <div className="loading-wrap">
          <div className="loading-bar-wrap">
            <div className="loading-bar" />
          </div>
          <div className="loading-text-wrap">
            <div className="spinner-ring" />
            <p className="loading-msg" key={msgIndex}>
              {LOADING_MESSAGES[msgIndex]}
            </p>
          </div>
        </div>
      ) : (
        <div className="index-form">
          <div className="tabs">
            <button
              className={`tab-btn ${tab === 'github' ? 'active' : ''}`}
              onClick={() => setTab('github')}
            >
              GitHub URL
            </button>
            <button
              className={`tab-btn ${tab === 'upload' ? 'active' : ''}`}
              onClick={() => setTab('upload')}
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
              autoFocus
            />
          ) : (
            <div className="file-drop">
              <input
                type="file"
                accept=".zip"
                onChange={e => setFile(e.target.files[0])}
              />
              {file ? (
                <span className="file-selected">{file.name}</span>
              ) : (
                <span>drop a zip file or click to browse</span>
              )}
            </div>
          )}

          <div className="index-actions">
            <button className="btn-primary" onClick={handleIndex} disabled={loading}>
              Index repository
            </button>
            <span className="hint">~30s for an average repo</span>
          </div>

          {error && <p className="error-msg">{error}</p>}
        </div>
      )}
    </div>
  );
}