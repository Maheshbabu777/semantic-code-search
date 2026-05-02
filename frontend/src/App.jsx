import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import IndexPage  from './pages/IndexPage';
import SearchPage from './pages/SearchPage';
import ChatPage   from './pages/ChatPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"       element={<IndexPage />}  />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/chat"   element={<ChatPage />}   />
        <Route path="*"       element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}