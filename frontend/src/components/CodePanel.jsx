import { useEffect } from 'react';

export default function CodePanel({ chunk, onClose, width = 420 }) {
  const isOpen = chunk !== null;

  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onClose();
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKey);
    }
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const parts     = chunk ? chunk.filepath.replace(/\\/g, '/').split('/') : [];
  const shortPath = parts.length >= 3 ? parts.slice(-3).join('/') : parts.join('/');
  const filename  = parts[parts.length - 1] || '';

  return (
    <div
      style={{
        width:         isOpen ? width : 0,
        minWidth:      isOpen ? width : 0,
        overflow:      'hidden',
        transition:    'width 0.3s cubic-bezier(0.22, 1, 0.36, 1), min-width 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
        borderLeft:    isOpen ? '1px solid var(--border)' : 'none',
        display:       'flex',
        flexDirection: 'column',
        background:    'var(--bg2)',
        flexShrink:    0,
        height:        '100vh',
        position:      'sticky',
        top:           0,
      }}
    >
      {chunk && (
        <>
          <div style={{
            display:        'flex',
            alignItems:     'flex-start',
            justifyContent: 'space-between',
            padding:        '16px 16px 12px',
            borderBottom:   '1px solid var(--border)',
            flexShrink:     0,
            gap:            12,
          }}>
            <div style={{ overflow: 'hidden' }}>
              <p style={{
                fontFamily:   'var(--font-mono)',
                fontSize:     '0.8125rem',
                fontWeight:   500,
                color:        'var(--text)',
                marginBottom: 3,
                overflow:     'hidden',
                textOverflow: 'ellipsis',
                whiteSpace:   'nowrap',
              }}>
                {filename}
              </p>
              <p style={{
                fontFamily:   'var(--font-mono)',
                fontSize:     '0.6875rem',
                color:        'var(--text-dim)',
                overflow:     'hidden',
                textOverflow: 'ellipsis',
                whiteSpace:   'nowrap',
                marginBottom: 6,
              }}>
                {shortPath}
              </p>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{
                  fontFamily:   'var(--font-mono)',
                  fontSize:     '0.6875rem',
                  color:        'var(--text-muted)',
                  background:   'var(--bg3)',
                  border:       '1px solid var(--border)',
                  borderRadius: 4,
                  padding:      '1px 7px',
                }}>
                  lines {chunk.start_line}–{chunk.end_line}
                </span>
                <span style={{
                  fontFamily:   'var(--font-mono)',
                  fontSize:     '0.6875rem',
                  color:        'var(--accent)',
                  background:   'var(--accent-dim)',
                  border:       '1px solid var(--accent-border)',
                  borderRadius: 4,
                  padding:      '1px 7px',
                }}>
                  {chunk.score?.toFixed(3)}
                </span>
              </div>
            </div>

            <button
              onClick={onClose}
              title="Close panel (Esc)"
              style={{
                background:  'transparent',
                border:      'none',
                cursor:      'pointer',
                color:       'var(--text-dim)',
                fontSize:    '1.125rem',
                lineHeight:  1,
                padding:     '2px 4px',
                borderRadius: 4,
                flexShrink:  0,
                transition:  'color 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-dim)'}
            >
              ✕
            </button>
          </div>

          <div style={{
            flex:       1,
            overflowY:  'auto',
            overflowX:  'auto',
            padding:    '12px 0',
          }}>
            <table style={{
              borderCollapse: 'collapse',
              width:          '100%',
              fontFamily:     'var(--font-mono)',
              fontSize:       '0.75rem',
              lineHeight:     1.6,
            }}>
              <tbody>
                {chunk.code.split('\n').map((line, i) => {
                  const lineNumber = chunk.start_line + i;
                  return (
                    <tr key={i} style={{ verticalAlign: 'top' }}>
                      <td style={{
                        userSelect:  'none',
                        color:       'var(--text-dim)',
                        textAlign:   'right',
                        paddingRight: 12,
                        paddingLeft:  12,
                        width:        1,
                        whiteSpace:  'nowrap',
                        opacity:     0.5,
                      }}>
                        {lineNumber}
                      </td>
                      <td style={{
                        color:       'var(--text)',
                        whiteSpace:  'pre',
                        paddingRight: 16,
                      }}>
                        {line || ' '}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}