export default function ResultCard({ result, index }) {
  const parts = result.filepath.replace(/\\/g, '/').split('/');
  const filename = parts.pop();
  const folder = parts.slice(-2).join('/');

  function scoreClass(score) {
    if (score >= 0.5) return 'score-high';
    if (score >= 0.25) return 'score-mid';
    return 'score-low';
  }

  return (
    <div className="result-card" style={{ animationDelay: `${index * 0.06}s` }}>
      <div className="result-meta">
        <span className={`badge-score ${scoreClass(result.score)}`}>
          {result.score.toFixed(4)}
        </span>
        <span className="badge-lines">
          {result.start_line}–{result.end_line}
        </span>
        <span className="filepath">
          <span>{folder}/</span>{filename}
        </span>
      </div>
      <pre className="code-block"><code>{result.code}</code></pre>
    </div>
  );
}