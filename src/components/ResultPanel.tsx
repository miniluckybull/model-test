interface ResultPanelProps {
  success: boolean
  latencyMs?: number
  tokens?: number
  response?: string
  error?: string
}

function ResultPanel({ success, latencyMs, tokens, response, error }: ResultPanelProps) {
  if (latencyMs === undefined && !error) return null

  return (
    <div className={`result-panel ${success ? 'success' : 'error'}`}>
      {success ? (
        <div>
          <div style={{ display: 'flex', gap: '16px', marginBottom: '8px' }}>
            <span>延迟：<strong>{latencyMs}ms</strong></span>
            <span>Tokens：<strong>{tokens}</strong></span>
          </div>
          {response && <pre>{response}</pre>}
        </div>
      ) : (
        <div>
          <strong>错误：</strong> {error}
        </div>
      )}
    </div>
  )
}

export default ResultPanel
