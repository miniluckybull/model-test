import { useState, useEffect, useCallback } from 'react'
import { ProjectEntry, TargetConfigInfo } from '../types'
import { listProjects, removeProject, scanClaudeTarget } from '../services/tauriCommands'

interface ConfigOverviewDialogProps {
  onClose: () => void
  /** 移除登记成功后通知外层刷新（如左侧目标列表联动） */
  onChanged?: () => void
}

interface OverviewRow {
  key: string
  label: string
  sub: string
  info: TargetConfigInfo
  entry?: ProjectEntry
}

function formatTime(iso?: string): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('zh-CN', { hour12: false })
}

function ConfigOverviewDialog({ onClose, onChanged }: ConfigOverviewDialogProps) {
  const [rows, setRows] = useState<OverviewRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const projects = await listProjects()
      const [globalInfo, ...projectInfos] = await Promise.all([
        scanClaudeTarget(undefined),
        ...projects.map((p) => scanClaudeTarget(p.path)),
      ])
      const projectRows: OverviewRow[] = projects.map((entry, i) => ({
        key: entry.path,
        label: entry.name,
        sub: entry.path,
        info: projectInfos[i],
        entry,
      }))
      setRows([
        {
          key: 'global',
          label: '全局配置',
          sub: '~/.claude/settings.json',
          info: globalInfo,
        },
        ...projectRows,
      ])
    } catch (err: any) {
      setError(err.toString())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleRemove = async (path: string) => {
    try {
      await removeProject(path)
      await load()
      onChanged?.()
    } catch (err: any) {
      setError(err.toString())
    }
  }

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-content dialog-large overview-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h2 className="dialog-title">配置总览</h2>
          <button className="dialog-close" onClick={onClose}>x</button>
        </div>

        <div className="dialog-body">
          {error && (
            <div className="error-state">
              <p className="error-message">{error}</p>
            </div>
          )}

          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>正在读取配置…</p>
            </div>
          ) : (
            <div className="overview-table-wrap">
              <table className="overview-table">
                <thead>
                  <tr>
                    <th>目标</th>
                    <th>配置来源</th>
                    <th>主模型</th>
                    <th>opus</th>
                    <th>sonnet</th>
                    <th>haiku</th>
                    <th>密钥</th>
                    <th>更新时间</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.key}>
                      <td>
                        <div className="overview-target">
                          <span className="overview-label">{row.label}</span>
                          <span className="overview-sub" title={row.sub}>{row.sub}</span>
                        </div>
                      </td>
                      <td>
                        {row.info.source_file ? (
                          <span className={`overview-badge ${row.info.source_file.includes('local') ? 'local' : 'shared'}`}>
                            {row.info.source_file}
                          </span>
                        ) : (
                          <span className="overview-badge none">未配置</span>
                        )}
                      </td>
                      <td className="overview-model">{row.info.model ?? '—'}</td>
                      <td className="overview-tier">{row.info.tier_opus ?? '—'}</td>
                      <td className="overview-tier">{row.info.tier_sonnet ?? '—'}</td>
                      <td className="overview-tier">{row.info.tier_haiku ?? '—'}</td>
                      <td>{row.info.has_secret ? '🔒' : '—'}</td>
                      <td className="overview-time">{formatTime(row.info.updated_at)}</td>
                      <td>
                        {row.entry && (
                          <button
                            className="btn btn-secondary overview-remove"
                            title="仅移除登记，不删除磁盘文件"
                            onClick={() => handleRemove(row.key)}
                          >
                            移除登记
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="field-hint overview-footnote">
            数据实时读取自磁盘：全局为 ~/.claude/settings.json，项目优先读取 .claude/settings.local.json。
            "移除登记"只从本应用的项目列表移除，不会删除任何配置文件。
          </p>
        </div>

        <div className="dialog-footer">
          <button className="btn btn-secondary" onClick={load} disabled={loading}>
            刷新
          </button>
          <button className="btn btn-primary" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfigOverviewDialog
