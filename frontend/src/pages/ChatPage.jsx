import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { chatStream, deleteSession } from '../api/client';
import ChatMessage from '../components/ChatMessage';

const CHUNK_CITE_RE = /\[Chunk\s+(\d+)\]/gi;

export default function ChatPage() {
  const navigate = useNavigate();

  const [messages,   setMessages]   = useState([]);
  const [input,      setInput]      = useState('');
  const [streaming,  setStreaming]  = useState(false);
  const [error,      setError]      = useState('');

  const streamingRef    = useRef(false);
  const abortCtrlRef    = useRef(null);
  const bottomRef       = useRef(null);
  const inputRef        = useRef(null);

  const sessionId    = localStorage.getItem('session_id');
  const indexedCount = localStorage.getItem('indexed_count');

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

  const handleSend = useCallback(async () => {
    const text = input.trim();

    if (streamingRef.current || !text) return;
    streamingRef.current = true;
    setStreaming(true);
    setError('');

    const historySnapshot = messages.slice(-10);

    setMessages(prev => [
      ...prev,
      { role: 'user',      content: text },
      { role: 'assistant', content: '', sources: [], citedChunks: [] },
    ]);
    setInput('');

    const ctrl = new AbortController();
    abortCtrlRef.current = ctrl;

    try {
      const reader  = await chatStream({
        message:   text,
        sessionId,
        history:   historySnapshot,
        signal:    ctrl.signal,
      });

      const decoder = new TextDecoder();
      let   buffer  = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          let event;
          try {
            event = JSON.parse(line.slice(6));
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
            setMessages(prev => {
              const updated  = [...prev];
              const last     = updated[updated.length - 1];
              const newContent = last.content + event.content;

              const cited = new Set(last.citedChunks || []);
              let m;
              CHUNK_CITE_RE.lastIndex = 0;
              while ((m = CHUNK_CITE_RE.exec(newContent)) !== null) {
                cited.add(Number(m[1]));
              }

              updated[updated.length - 1] = {
                ...last,
                content:     newContent,
                citedChunks: [...cited],
              };
              return updated;
            });
          }

          else if (event.type === 'error') {
            throw new Error(event.message);
          }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        setMessages(prev => {
          const updated = [...prev];
          const last    = updated[updated.length - 1];
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
    setMessages([]);
    setError('');
    setInput('');
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  async function handleExit() {
    if (abortCtrlRef.current) abortCtrlRef.current.abort();
    try { await deleteSession(sessionId); } catch (_) {}
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

  return (
    <div style={{
      display:       'flex',
      flexDirection: 'column',
      height:        '100vh',
      maxWidth:      780,
      margin:        '0 auto',
      padding:       '0 32px',
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

      <div className="chat-messages" style={{
        flex:       1,
        overflowY:  'auto',
        paddingTop: 8,
        paddingBottom: 16,
      }}>
        {messages.length === 0 && (
          <div style={{
            display:        'flex',
            flexDirection:  'column',
            alignItems:     'center',
            justifyContent: 'center',
            height:         '100%',
            gap:            12,
            color:          'var(--text-dim)',
          }}>
            <p style={{ fontSize: '1.5rem', fontWeight: 300 }}>Ask anything</p>
            <p style={{ fontSize: '0.875rem', fontStyle: 'italic' }}>
              about the indexed codebase
            </p>
            <div style={{
              display:   'flex',
              flexWrap:  'wrap',
              gap:       8,
              marginTop: 8,
              justifyContent: 'center',
            }}>
              {[
                'How does chunking work?',
                'Explain the search pipeline',
                'How are sessions cleaned up?',
                'What algorithms are used for exact search?',
              ].map(suggestion => (
                <button
                  key={suggestion}
                  onClick={() => { setInput(suggestion); inputRef.current?.focus(); }}
                  style={{
                    background:   'var(--bg2)',
                    border:       '1px solid var(--border)',
                    borderRadius: 8,
                    padding:      '6px 12px',
                    fontSize:     '0.8125rem',
                    color:        'var(--text-muted)',
                    cursor:       'pointer',
                    transition:   'border-color 0.15s, color 0.15s',
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
          />
        ))}

        <div ref={bottomRef} />
      </div>

      <div style={{
        flexShrink:   0,
        paddingTop:   12,
        paddingBottom: 24,
        borderTop:    '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
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
            style={{
              flex:        1,
              fontFamily:  'var(--font-sans)',
              fontSize:    '0.9375rem',
              padding:     '12px 16px',
              background:  'var(--bg2)',
              border:      '1px solid var(--border)',
              borderRadius: 10,
              color:       'var(--text)',
              outline:     'none',
              resize:      'none',
              lineHeight:  1.5,
              minHeight:   48,
              maxHeight:   160,
              transition:  'border-color 0.2s',
              overflowY:   'auto',
            }}
            onFocus={e  => e.target.style.borderColor = 'var(--border-hover)'}
            onBlur={e   => e.target.style.borderColor = 'var(--border)'}
          />

          {streaming ? (
            <button
              className="btn-primary"
              onClick={handleStop}
              style={{ background: 'var(--score-low)', flexShrink: 0 }}
            >
              stop
            </button>
          ) : (
            <button
              className="btn-primary"
              onClick={handleSend}
              disabled={!input.trim()}
              style={{ flexShrink: 0 }}
            >
              send
            </button>
          )}
        </div>

        {!streaming && messages.length > 0 && (
          <p style={{
            fontSize:  '0.75rem',
            color:     'var(--text-dim)',
            marginTop: 8,
            fontStyle: 'italic',
          }}>
            history capped at last 10 messages sent to the model
          </p>
        )}
      </div>
    </div>
  );
}