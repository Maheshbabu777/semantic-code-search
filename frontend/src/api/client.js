import axios from 'axios';

const pythonApi = axios.create({ baseURL: 'http://localhost:8000' });
const nodeApi = axios.create({ baseURL: 'http://localhost:3001' });

export async function indexRepo(githubUrl) {
  const res = await pythonApi.post('/index', { github_url: githubUrl });
  return res.data;
}

export async function uploadZip(file) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await pythonApi.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export async function searchCode(query, sessionId, topK = 5) {
  const res = await pythonApi.post('/search', {
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
  const res = await pythonApi.delete(`/session/${sessionId}`);
  return res.data;
}

export function isExactPattern(query) {
  return !query.trim().includes(' ') && query.trim().length < 40;
}