import axios from 'axios';

const API_BASE  = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const pythonApi = axios.create({ baseURL: API_BASE });
const nodeApi   = axios.create({ baseURL: import.meta.env.VITE_NODE_URL || 'http://localhost:3001' });

export async function indexRepo(githubUrl) {
  const res = await pythonApi.post('/index/', { github_url: githubUrl });
  return res.data;
}

export async function uploadZip(file) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await pythonApi.post('/upload/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export async function searchCode(query, sessionId, topK = 5) {
  const res = await pythonApi.post('/search/', {
    query,
    session_id: sessionId,
    top_k: topK,
  });
  return res.data;
}

export async function exactSearch(text, pattern) {
  const res = await nodeApi.post('/search', { text, pattern, algorithm: 'kmp' });
  return res.data;
}

export async function deleteSession(sessionId) {
  const res = await pythonApi.delete(`/session/${sessionId}/`);
  return res.data;
}

export function isExactPattern(query) {
  return !query.trim().includes(' ') && query.trim().length < 40;
}

export async function chatStream({ message, sessionId, history, signal }) {
  const res = await fetch(`${API_BASE}/chat/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      session_id: sessionId,
      history: history.map(m => ({ role: m.role, content: m.content })),
    }),
    signal,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `HTTP ${res.status}`);
  }

  return res.body.getReader();
}