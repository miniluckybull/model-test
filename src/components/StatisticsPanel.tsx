import { useMemo } from 'react'
import { useConfigStore } from '../store/configStore'

export function StatisticsPanel() {
  const configs = useConfigStore((state) => state.configs)

  const stats = useMemo(() => {
    const total = configs.length
    const tested = configs.filter(c => c.lastTestedAt).length
    const ok = configs.filter(c => c.status === 'ok').length
    const failed = configs.filter(c => c.status === 'failed').length

    const latencies = configs
      .filter(c => c.lastLatency !== undefined)
      .map(c => c.lastLatency!)

    const avgLatency = latencies.length > 0
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : 0

    const fastestLatency = latencies.length > 0 ? Math.min(...latencies) : 0
    const slowestLatency = latencies.length > 0 ? Math.max(...latencies) : 0

    const byProvider = configs.reduce((acc, c) => {
      acc[c.provider] = (acc[c.provider] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const successRate = tested > 0 ? Math.round((ok / tested) * 100) : 0

    return {
      total,
      tested,
      ok,
      failed,
      avgLatency,
      fastestLatency,
      slowestLatency,
      byProvider,
      successRate,
    }
  }, [configs])

  if (stats.total === 0) {
    return null
  }

  return (
    <div className="statistics-panel">
      <h3>Statistics</h3>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value-lg">{stats.total}</div>
          <div className="stat-label">Total Configs</div>
        </div>

        <div className="stat-card">
          <div className="stat-value-lg stat-ok">{stats.ok}</div>
          <div className="stat-label">Available</div>
        </div>

        <div className="stat-card">
          <div className="stat-value-lg stat-failed">{stats.failed}</div>
          <div className="stat-label">Failed</div>
        </div>

        <div className="stat-card">
          <div className="stat-value-lg">{stats.successRate}%</div>
          <div className="stat-label">Success Rate</div>
        </div>

        {stats.avgLatency > 0 && (
          <>
            <div className="stat-card">
              <div className="stat-value-lg">{stats.avgLatency}ms</div>
              <div className="stat-label">Avg Latency</div>
            </div>

            <div className="stat-card">
              <div className="stat-value-lg stat-ok">{stats.fastestLatency}ms</div>
              <div className="stat-label">Fastest</div>
            </div>

            <div className="stat-card">
              <div className="stat-value-lg stat-failed">{stats.slowestLatency}ms</div>
              <div className="stat-label">Slowest</div>
            </div>
          </>
        )}
      </div>

      {Object.keys(stats.byProvider).length > 0 && (
        <div className="provider-stats">
          <h4>By Provider</h4>
          <div className="provider-grid">
            {Object.entries(stats.byProvider).map(([provider, count]) => (
              <div key={provider} className="provider-item">
                <span className="provider-name">{provider}</span>
                <span className="provider-count">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
