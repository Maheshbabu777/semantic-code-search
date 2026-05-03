import SourcePills from './SourcePills';

function renderInline(text, key) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <span key={key}>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={i} style={{ color: 'var(--text)', fontWeight: 500 }}>
              {part.slice(2, -2)}
            </strong>
          );
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return (
            <code key={i} style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.8rem',
              background: 'var(--bg3)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              padding: '1px 6px',
              color: 'var(--accent)',
              whiteSpace: 'nowrap',
            }}>
              {part.slice(1, -1)}
            </code>
          );
        }
        return part;
      })}
    </span>
  );
}

function renderContent(text) {
  const segments = text.split(/(```[\s\S]*?```)/g);

  return segments.map((segment, si) => {
    if (segment.startsWith('```')) {
      const inner = segment
        .replace(/^```[^\n]*\n?/, '')
        .replace(/```$/, '');
      return (
        <pre key={si} className="code-block" style={{ marginTop: 10, marginBottom: 10 }}>
          <code>{inner}</code>
        </pre>
      );
    }

    const lines = segment.split('\n');
    return (
      <span key={si}>
        {lines.map((line, li) => {
          if (!line.trim()) {
            return <div key={li} style={{ height: 6 }} />;
          }

          const h3Match = line.match(/^###\s+(.*)/);
          if (h3Match) {
            return (
              <div key={li} style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text)', margin: '10px 0 4px' }}>
                {renderInline(h3Match[1], `h3-${li}`)}
              </div>
            );
          }

          const h2Match = line.match(/^##\s+(.*)/);
          if (h2Match) {
            return (
              <div key={li} style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text)', margin: '12px 0 4px' }}>
                {renderInline(h2Match[1], `h2-${li}`)}
              </div>
            );
          }

          const h1Match = line.match(/^#\s+(.*)/);
          if (h1Match) {
            return (
              <div key={li} style={{ fontWeight: 600, fontSize: '1.0625rem', color: 'var(--text)', margin: '14px 0 4px' }}>
                {renderInline(h1Match[1], `h1-${li}`)}
              </div>
            );
          }

          const orderedMatch = line.match(/^(\d+)\.\s+(.*)/);
          if (orderedMatch) {
            return (
              <div key={li} style={{
                display: 'flex',
                gap: 8,
                marginBottom: 4,
                paddingLeft: 4,
              }}>
                <span style={{
                  color: 'var(--accent)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.8125rem',
                  flexShrink: 0,
                  minWidth: 18,
                }}>
                  {orderedMatch[1]}.
                </span>
                <span>{renderInline(orderedMatch[2], `ol-${li}`)}</span>
              </div>
            );
          }

          const bulletMatch = line.match(/^[-*]\s+(.*)/);
          if (bulletMatch) {
            return (
              <div key={li} style={{
                display: 'flex',
                gap: 8,
                marginBottom: 4,
                paddingLeft: 4,
              }}>
                <span style={{ color: 'var(--accent)', flexShrink: 0 }}>·</span>
                <span>{renderInline(bulletMatch[1], `ul-${li}`)}</span>
              </div>
            );
          }

          return (
            <span key={li} style={{ display: 'inline' }}>
              {renderInline(line, `l-${li}`)}
              {li < lines.length - 1 && line.trim() && lines[li + 1]?.trim() && ' '}
            </span>
          );
        })}
      </span>
    );
  });
}

export default function ChatMessage({
  message,
  isStreaming,
  onChunkClick = null,
  activeChunk  = null,
}) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        marginBottom: 16,
      }}>
        <div style={{
          maxWidth: '72%',
          background: 'var(--accent-dim)',
          border: '1px solid var(--accent-border)',
          borderRadius: '12px 12px 4px 12px',
          padding: '10px 14px',
          fontSize: '0.9375rem',
          color: 'var(--text)',
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}>
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 20 }}>
      <p style={{
        fontSize: '0.6875rem',
        color: 'var(--text-dim)',
        fontFamily: 'var(--font-mono)',
        marginBottom: 6,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
      }}>
        assistant
      </p>

      {message.sources && message.sources.length > 0 && (
        <SourcePills
          sources={message.sources}
          citedChunks={message.citedChunks || []}
          onChunkClick={onChunkClick}
          activeChunk={activeChunk}
        />
      )}

      <div style={{
        fontSize: '0.9375rem',
        color: 'var(--text)',
        lineHeight: 1.7,
        wordBreak: 'break-word',
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
            display: 'inline-block',
            width: 2,
            height: '1em',
            background: 'var(--accent)',
            marginLeft: 2,
            verticalAlign: 'text-bottom',
            animation: 'blink 1s step-end infinite',
          }} />
        )}
      </div>
    </div>
  );
}