export default function ResultCard({ result }) {
  const filename = result.filepath.split('/').pop();
  const folder = result.filepath.split('/').slice(-3, -1).join('/');

  return (
    <div style={{
      background: '#fafaf8',
      border: '0.5px solid #e0dfd8',
      borderRadius: 10,
      padding: 16,
      marginBottom: 12,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 10,
        flexWrap: 'wrap',
      }}>
        <span style={{
          background: '#E1F5EE',
          color: '#0F6E56',
          fontSize: 12,
          fontWeight: 600,
          padding: '2px 8px',
          borderRadius: 4,
        }}>
          score {result.score}
        </span>
        <span style={{
          background: 'white',
          border: '0.5px solid #d0cec7',
          color: '#6b6a65',
          fontSize: 12,
          padding: '2px 8px',
          borderRadius: 4,
        }}>
          lines {result.start_line}–{result.end_line}
        </span>
        <span style={{ fontSize: 12, color: '#9b9a95', fontFamily: 'monospace' }}>
          {folder}/{filename}
        </span>
      </div>

      <pre style={{
        background: 'white',
        border: '0.5px solid #e0dfd8',
        borderRadius: 6,
        padding: '10px 14px',
        fontSize: 12,
        overflowX: 'auto',
        whiteSpace: 'pre',
        lineHeight: 1.6,
        margin: 0,
        maxHeight: 200,
        overflowY: 'auto',
      }}>
        <code>{result.code}</code>
      </pre>
    </div>
  );
}