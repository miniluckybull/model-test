import type { ApiConfig } from '../types'

interface Props {
  config: ApiConfig
}

export default function CompactCard({ config }: Props) {
  const status = config.status || 'idle'

  const statusColor: Record<string, string> = {
    idle: 'var(--blue)',
    running: 'var(--amber)',
    ok: 'var(--green)',
    failed: 'var(--red)',
  }

  return (
    <div className="compact-card">
      <div className="compact-status" style={{ background: statusColor[status] }} />
      <div className="compact-info">
        <div className="compact-name" title={config.name}>
          {config.name}
        </div>
        <div className="compact-meta">
          {config.lastLatency ? (
            <span>{config.lastLatency}ms</span>
          ) : (
            <span>未测试</span>
          )}
        </div>
      </div>
    </div>
  )
}
