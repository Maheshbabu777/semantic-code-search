export default function SourcePills({
  sources,
  citedChunks   = [],
  onChunkClick  = null,
  activeChunk   = null,
}) {
  if (!sources || sources.length === 0) return null;

  const citedSet = new Set(citedChunks);

  return (
    <div style={{
      display:      'flex',
      flexWrap:     'wrap',
      gap:          5,
      marginBottom: 10,
    }}>
      {sources.map((chunk, i) => {
        const chunkIndex = i + 1;
        const isCited    = citedSet.has(chunkIndex);
        const isActive   = activeChunk &&
          activeChunk.filepath   === chunk.filepath &&
          activeChunk.start_line === chunk.start_line;

        const parts    = chunk.filepath.replace(/\\/g, '/').split('/');
        const filename = parts[parts.length - 1];
        const folder   = parts.length >= 2 ? parts[parts.length - 2] : '';

        const borderColor = isActive
          ? 'var(--accent)'
          : isCited
            ? 'var(--accent-border)'
            : 'var(--border)';

        const bgColor = isActive
          ? 'var(--accent-dim)'
          : isCited
            ? 'var(--accent-dim)'
            : 'var(--bg2)';

        return (
          <div
            key={i}
            onClick={() => onChunkClick && onChunkClick(isActive ? null : chunk)}
            title={`${chunk.filepath} · lines ${chunk.start_line}–${chunk.end_line} · score ${chunk.score?.toFixed(3)} · click to view`}
            style={{
              display:       'inline-flex',
              alignItems:    'center',
              gap:           4,
              padding:       '2px 8px',
              borderRadius:  5,
              border:        `1px solid ${borderColor}`,
              background:    bgColor,
              transition:    'background 0.2s, border-color 0.2s, opacity 0.15s',
              cursor:        onChunkClick ? 'pointer' : 'default',
              width:         'fit-content',
              maxWidth:      '100%',
              overflow:      'hidden',
              outline:       isActive ? '1px solid var(--accent)' : 'none',
              outlineOffset: 1,
            }}
            onMouseEnter={e => {
              if (!isActive) {
                e.currentTarget.style.borderColor = 'var(--border-hover)';
                e.currentTarget.style.opacity = '0.85';
              }
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = borderColor;
              e.currentTarget.style.opacity = '1';
            }}
          >
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize:   '0.625rem',
              fontWeight: 600,
              color:      isActive || isCited ? 'var(--accent)' : 'var(--text-dim)',
              flexShrink: 0,
              transition: 'color 0.2s',
            }}>
              {chunkIndex}
            </span>

            <span style={{
              fontFamily:   'var(--font-mono)',
              fontSize:     '0.6875rem',
              color:        isActive || isCited ? 'var(--text)' : 'var(--text-muted)',
              overflow:     'hidden',
              textOverflow: 'ellipsis',
              whiteSpace:   'nowrap',
              transition:   'color 0.2s',
            }}>
              {folder && (
                <span style={{
                  color: isActive || isCited ? 'var(--text-muted)' : 'var(--text-dim)',
                }}>
                  {folder}/
                </span>
              )}
              {filename}
            </span>

            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize:   '0.625rem',
              color:      'var(--text-dim)',
              flexShrink: 0,
            }}>
              {chunk.start_line}–{chunk.end_line}
            </span>
          </div>
        );
      })}
    </div>
  );
}