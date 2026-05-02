export default function SourcePills({ sources, citedChunks = [] }) {
  if (!sources || sources.length === 0) return null;

  const citedSet = new Set(citedChunks);

  return (
    <div style={{
      display:    'flex',
      flexWrap:   'wrap',
      gap:        6,
      marginBottom: 10,
    }}>
      {sources.map((chunk, i) => {
        const chunkIndex  = i + 1;
        const isCited     = citedSet.has(chunkIndex);
        const parts       = chunk.filepath.replace(/\\/g, '/').split('/');
        const filename    = parts[parts.length - 1];
        const folder      = parts.length >= 2 ? parts[parts.length - 2] : '';

        return (
          <div
            key={i}
            title={`${chunk.filepath} · lines ${chunk.start_line}–${chunk.end_line} · score ${chunk.score?.toFixed(3)}`}
            style={{
              display:      'inline-flex',
              alignItems:   'center',
              gap:          5,
              padding:      '3px 9px',
              borderRadius: 6,
              border:       `1px solid ${isCited ? 'var(--accent-border)' : 'var(--border)'}`,
              background:   isCited ? 'var(--accent-dim)' : 'var(--bg2)',
              transition:   'background 0.25s, border-color 0.25s',
              cursor:       'default',
            }}
          >
            <span style={{
              fontFamily:  'var(--font-mono)',
              fontSize:    '0.6875rem',
              color:       isCited ? 'var(--accent)' : 'var(--text-dim)',
              fontWeight:  500,
              transition:  'color 0.25s',
            }}>
              {chunkIndex}
            </span>

            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize:   '0.75rem',
              color:      isCited ? 'var(--text)' : 'var(--text-muted)',
              transition: 'color 0.25s',
            }}>
              {folder && (
                <span style={{ color: isCited ? 'var(--text-muted)' : 'var(--text-dim)' }}>
                  {folder}/
                </span>
              )}
              {filename}
            </span>

            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize:   '0.6875rem',
              color:      'var(--text-dim)',
            }}>
              {chunk.start_line}–{chunk.end_line}
            </span>
          </div>
        );
      })}
    </div>
  );
}