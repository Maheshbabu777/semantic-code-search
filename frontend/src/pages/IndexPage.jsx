import { useEffect, useRef, useState } from 'react';
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
  const TAB_EASE = '420ms cubic-bezier(0.22, 1, 0.36, 1)';

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
    if (loading) return; 

    setError('');

    const activeTab = tab; 
    const trimmedUrl = githubUrl.trim();

    if (activeTab === 'github' && !trimmedUrl) {
      setError('Please enter a GitHub URL.');
      return;
    }

    if (activeTab === 'upload' && !file) {
      setError('Please select a zip file.');
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 140));
    setLoading(true);

    try {
      const result =
        activeTab === 'github'
          ? await indexRepo(trimmedUrl)
          : await uploadZip(file);

      localStorage.setItem('session_id', String(result.session_id));
      localStorage.setItem('indexed_count', String(result.indexed));
      navigate('/search');
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
        err?.message ||
        'Something went wrong. Try again.'
      );
    } finally {
      setLoading(false);
    }
  }

  function panelStyle(active, direction = 1) {
    return {
      position: 'absolute',
      inset: 0,
      opacity: active ? 1 : 0,
      transform: active
        ? 'translateX(0) scale(1)'
        : `translateX(${direction * 18}px) scale(0.985)`,
      filter: active ? 'blur(0px)' : 'blur(1.5px)',
      transition: `opacity ${TAB_EASE}, transform ${TAB_EASE}, filter ${TAB_EASE}`,
      pointerEvents: active ? 'auto' : 'none',
      willChange: 'opacity, transform, filter',
    };
  }

  return (
    <div className="page page-enter">
      <div
        className="index-header marginbottom-40"
        style={{ marginBottom: 120 }}
      >
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
              onMouseDown={e => e.preventDefault()} // remove press/focus click effect
              onClick={() => setTab('github')}
              style={{
                WebkitTapHighlightColor: 'transparent',
                transition: `color ${TAB_EASE}, background-color ${TAB_EASE}, box-shadow ${TAB_EASE}`,
              }}
            >
              GitHub URL
            </button>
            <button
              className={`tab-btn ${tab === 'upload' ? 'active' : ''}`}
              onMouseDown={e => e.preventDefault()} // remove press/focus click effect
              onClick={() => setTab('upload')}
              style={{
                WebkitTapHighlightColor: 'transparent',
                transition: `color ${TAB_EASE}, background-color ${TAB_EASE}, box-shadow ${TAB_EASE}`,
              }}
            >
              Upload zip
            </button>
          </div>

          <div style={{ position: 'relative', minHeight: 84, overflow: 'hidden' }}>
            <div style={panelStyle(tab === 'github', -1)} aria-hidden={tab !== 'github'}>
              <input
                type="text"
                placeholder="https://github.com/username/repo"
                value={githubUrl}
                onChange={e => setGithubUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleIndex()}
                autoFocus={tab === 'github'}
              />
            </div>

            <div style={panelStyle(tab === 'upload', 1)} aria-hidden={tab !== 'upload'}>
              <div className="file-drop">
                <input
                  type="file"
                  accept=".zip"
                  onChange={e => setFile(e.target.files[0])}
                  disabled={tab !== 'upload'}
                />
                {file ? (
                  <span className="file-selected">{file.name}</span>
                ) : (
                  <span>drop a zip file or click to browse</span>
                )}
              </div>
            </div>
          </div>

          <div className="index-actions">
            <button className="btn-primary" onClick={handleIndex} disabled={loading}>
              Index your Codebase
            </button>
            <span className="hint">~30s for an average repo</span>
          </div>

          {error && <p className="error-msg">{error}</p>}
        </div>
      )}
    </div>
  );
}