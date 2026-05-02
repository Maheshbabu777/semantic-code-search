import SourcePills from './SourcePills';

export default function ChatMessage({ message, isStreaming }) {
  const isUser = message.role === 'user';

  function renderContent(text) {
    const parts  = text.split(/(```[\s\S]*?```)/g);
    return parts.map((part, i) => {
      if (part.startsWith('```')) {
        const inner = part.replace(/^```[^\n]*\n?/, '').replace(/```$/, '');
        return (
          <pre key={i} className="code-block" style={{ marginTop: 10, marginBottom: 10 }}>
            <code>{inner}</code>
          </pre>
        );
      }
      return (
        <span key={i} style={{ whiteSpace: 'pre-wrap' }}>{part}</span>
      );
    });
  }

  if (isUser) {
    return (
      <div style={{
        display:        'flex',
        justifyContent: 'flex-end',
        marginBottom:   16,
      }}>
        <div style={{
          maxWidth:        '72%',
          background:      'var(--accent-dim)',
          border:          '1px solid var(--accent-border)',
          borderRadius:    '12px 12px 4px 12px',
          padding:         '10px 14px',
          fontSize:        '0.9375rem',
          color:           'var(--text)',
          lineHeight:      1.6,
          whiteSpace:      'pre-wrap',
          wordBreak:       'break-word',
        }}>
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 20 }}>
      <p style={{
        fontSize:     '0.6875rem',
        color:        'var(--text-dim)',
        fontFamily:   'var(--font-mono)',
        marginBottom: 6,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
      }}>
        assistant
      </p>

      {message.sources && message.sources.length > 0 && (
        <SourcePills sources={message.sources} citedChunks={message.citedChunks || []} />
      )}

      <div style={{
        fontSize:   '0.9375rem',
        color:      'var(--text)',
        lineHeight: 1.7,
        wordBreak:  'break-word',
      }}>
        {message.content
          ? renderContent(message.content)
          : !isStreaming && (
              <span style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>
                no response
              </span>
            )
        }
        {isStreaming && (
          <span style={{
            display:      'inline-block',
            width:        2,
            height:       '1em',
            background:   'var(--accent)',
            marginLeft:   2,
            verticalAlign: 'text-bottom',
            animation:    'blink 1s step-end infinite',
          }} />
        )}
      </div>
    </div>
  );
}