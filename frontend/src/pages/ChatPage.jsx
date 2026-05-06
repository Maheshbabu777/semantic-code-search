import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { chatStream, deleteSession } from '../api/client';
import ChatMessage from '../components/ChatMessage';
import CodePanel from '../components/CodePanel';

const CHUNK_CITE_RE = /\[Chunk\s+(\d+)\]/gi;

export default function ChatPage() {
  const navigate = useNavigate();

  const sessionId = localStorage.getItem('session_id');
  const indexedCount = localStorage.getItem('indexed_count');

  const [messages, setMessages] = useState(() => {
    const saved = sessionStorage.getItem(`chat_${sessionId}`);
    return saved ? JSON.parse(saved) : [];
  });
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState('');
  const [activeChunk, setActiveChunk] = useState(null);
  const [panelWidth, setPanelWidth] = useState(420);

  const streamingRef = useRef(false);
  const abortCtrlRef = useRef(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const resizeRef = useRef(null);
  const chatScrollRef = useRef(null);

  const handleOuterWheel = useCallback((e) => {
    if (!chatScrollRef.current) return;
  
    if (e.target.closest('[data-code-panel]')) return;
    if (e.target.closest('pre') || e.target.closest('code')) return;
    
    chatScrollRef.current.scrollTop += e.deltaY;
  }, []);

  useEffect(() => {
    if (!sessionId) navigate('/');
  }, [sessionId, navigate]);

  useEffect(() => {
    return () => {
      if (abortCtrlRef.current) abortCtrlRef.current.abort();
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streaming]);

  useEffect(() => {
    if (sessionId) {
      sessionStorage.setItem(`chat_${sessionId}`, JSON.stringify(messages));
    }
  }, [messages, sessionId]);

  const handleChunkClick = useCallback((chunk) => {
    setActiveChunk(prev =>
      prev && chunk &&
        prev.filepath === chunk.filepath &&
        prev.start_line === chunk.start_line
        ? null
        : chunk
    );
  }, []);

  const handleClosePanel = useCallback(() => setActiveChunk(null), []);

  const handleSend = useCallback(async () => {
    const text = input.trim();

    if (streamingRef.current || !text) return;
    streamingRef.current = true;
    setStreaming(true);
    setError('');

    const historySnapshot = messages.slice(-10);

    setMessages(prev => [
      ...prev,
      { role: 'user', content: text },
      { role: 'assistant', content: '', sources: [], citedChunks: [] },
    ]);
    setInput('');

    const ctrl = new AbortController();
    abortCtrlRef.current = ctrl;

    try {
      const reader = await chatStream({
        message: text,
        sessionId,
        history: historySnapshot,
        signal: ctrl.signal,
      });

      const decoder = new TextDecoder();
      let buffer = '';
      let pendingText = '';
      let flushTimer = null;

      const flushText = () => {
        if (!pendingText) return;
        const text = pendingText;
        pendingText = '';
        setMessages(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          const newContent = (last?.content || '') + text;

          const cited = new Set(last?.citedChunks || []);
          let m;
          CHUNK_CITE_RE.lastIndex = 0;
          while ((m = CHUNK_CITE_RE.exec(newContent)) !== null) {
            cited.add(Number(m[1]));
          }

          updated[updated.length - 1] = {
            ...last,
            content: newContent,
            citedChunks: [...cited],
          };
          return updated;
        });
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split('\n\n'); 
        buffer = blocks.pop();

        for (const block of blocks) {
          const line = block.startsWith('data: ') ? block.slice(6) : null;
          if (!line) continue;

          let event;
          try {
            event = JSON.parse(line);
          } catch {
            continue;
          }

          if (event.type === 'context') {
            setMessages(prev => {
              const updated = [...prev];
              updated[updated.length - 1] = {
                ...updated[updated.length - 1],
                sources: event.chunks,
              };
              return updated;
            });
          }

          else if (event.type === 'text') {
            pendingText += event.content;
            if (flushTimer) clearTimeout(flushTimer);
            flushTimer = setTimeout(flushText, 30);
          }

          else if (event.type === 'error') {
            throw new Error(event.message);
          }
        }
      }

      if (flushTimer) clearTimeout(flushTimer);
      flushText();
    } catch (err) {
      if (err.name === 'AbortError') {
        setMessages(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === 'assistant' && !last.content) {
            return updated.slice(0, -1);
          }
          return updated;
        });
      } else {
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content: `Error: ${err.message}`,
          };
          return updated;
        });
        setError(err.message);
      }
    } finally {
      streamingRef.current = false;
      setStreaming(false);
      abortCtrlRef.current = null;
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [input, messages, sessionId]);

  function handleStop() {
    if (abortCtrlRef.current) abortCtrlRef.current.abort();
  }

  function handleNewChat() {
    if (streamingRef.current) handleStop();
    sessionStorage.removeItem(`chat_${sessionId}`);
    setMessages([]);
    setError('');
    setInput('');
    setActiveChunk(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  async function handleExit() {
    if (abortCtrlRef.current) abortCtrlRef.current.abort();
    sessionStorage.removeItem(`chat_${sessionId}`);
    try { await deleteSession(sessionId); } catch (_) { }
    localStorage.removeItem('session_id');
    localStorage.removeItem('indexed_count');
    navigate('/');
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = panelWidth;

    const handleMouseMove = (moveEvent) => {
      const delta = moveEvent.clientX - startX;
      const newWidth = Math.max(300, Math.min(window.innerWidth * 0.5, startWidth - delta));
      setPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [panelWidth]);

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      overflow: 'hidden',
    }}>
      <div
        onWheel={handleOuterWheel}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          overflow: 'hidden',
          transition: 'flex 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
        }}>
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          maxWidth: 780,
          width: '100%',
          margin: '0 auto',
          padding: '0 32px',
          minWidth: 0,
          overflow: 'hidden',
        }}>
          <div className="search-header" style={{ paddingTop: 24, paddingBottom: 16, flexShrink: 0 }}>
            <span className="status-pill">
              <span className="status-dot" />
              {Number(indexedCount).toLocaleString()} chunks indexed
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                className="btn-ghost"
                onClick={handleNewChat}
                disabled={streaming}
                title="Clear conversation history"
              >
                new chat
              </button>
              <button
                className="btn-ghost"
                onClick={() => navigate('/search')}
                title="Switch to search mode"
              >
                Search
              </button>
              <button className="btn-exit" onClick={handleExit}>
                exit session
              </button>
            </div>
          </div>

          <div ref={chatScrollRef} className="chat-messages" style={{
            flex: 1,
            overflowY: 'auto',
            paddingTop: 8,
            paddingBottom: 16,
          }}>
            {messages.length === 0 && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                gap: 12,
                color: 'var(--text-dim)',
              }}>
                <p style={{ fontSize: '1.5rem', fontWeight: 300 }}>Ask anything</p>
                <p style={{ fontSize: '0.875rem', fontStyle: 'italic' }}>
                  about the indexed codebase
                </p>
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 8,
                  marginTop: 8,
                  justifyContent: 'center',
                }}>
                  {[
                    'What is this project about?',
                    'How does the database layer work?',
                    'Where is the main entry point?',
                    'How do I run or build this project?',
                  ].map(suggestion => (
                    <button
                      key={suggestion}
                      onClick={() => { setInput(suggestion); inputRef.current?.focus(); }}
                      style={{
                        background: 'var(--bg2)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        padding: '6px 12px',
                        fontSize: '0.8125rem',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        transition: 'border-color 0.15s, color 0.15s',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = 'var(--border-hover)';
                        e.currentTarget.style.color = 'var(--text)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = 'var(--border)';
                        e.currentTarget.style.color = 'var(--text-muted)';
                      }}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <ChatMessage
                key={i}
                message={msg}
                isStreaming={streaming && i === messages.length - 1 && msg.role === 'assistant'}
                onChunkClick={handleChunkClick}
                activeChunk={activeChunk}
              />
            ))}

            <div ref={bottomRef} />
          </div>

          <div style={{
            flexShrink: 0,
            paddingTop: 12,
            paddingBottom: 24,
            borderTop: '1px solid var(--border)',
          }}>
            <div className="chat-input-wrap">
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={e => {
                  setInput(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px';
                }}
                onKeyDown={handleKeyDown}
                placeholder="Ask about the codebase… (Enter to send, Shift+Enter for newline)"
                disabled={streaming}
                className="chat-input"
                onFocus={e => e.target.style.borderColor = 'var(--border-hover)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />

              {streaming ? (
                <button
                  onClick={handleStop}
                  className="chat-input-btn stop"
                  title="Stop generating"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <path
                      d="M5.25 7.5A2.25 2.25 0 0 1 7.5 5.25h9a2.25 2.25 0 0 1 2.25 2.25v9a2.25 2.25 0 0 1-2.25 2.25h-9a2.25 2.25 0 0 1-2.25-2.25v-9Z"
                    />
                  </svg>
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="chat-input-btn send"
                  title="Send message"
                >
                  ↑
                </button>
              )}
            </div>

            {!streaming && messages.length > 0 && (
              <p style={{
                fontSize: '0.75rem',
                color: 'var(--text-dim)',
                marginTop: 8,
                fontStyle: 'italic',
              }}>
                history capped at last 4 messages sent to the model
              </p>
            )}
          </div>
        </div>
      </div>

      <div
        ref={resizeRef}
        onMouseDown={handleMouseDown}
        style={{
          width: 4,
          background: 'var(--border)',
          cursor: 'col-resize',
          flexShrink: 0,
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--accent)'}
        onMouseLeave={e => e.currentTarget.style.background = 'var(--border)'}
      />

      <CodePanel
        chunk={activeChunk}
        onClose={handleClosePanel}
        width={panelWidth}
      />
    </div>
  );
}