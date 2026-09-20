import { useState, useEffect, useCallback } from 'react'
import { ApiConfig, ConfigComparison, ExportToProjectResult, ModelTiers } from '../types'
import {
  previewClaudeConfig,
  applyClaudeConfig,
  applyCustomClaudeConfig,
  exportToProject,
  buildClaudeRequest,
} from '../services/tauriCommands'
import { useConfigStore } from '../store/configStore'
import { open, save, ask } from '@tauri-apps/plugin-dialog'

const TIER_KEYS = ['opus', 'sonnet', 'haiku'] as const
type TierKey = (typeof TIER_KEYS)[number]

const TIER_HINTS: Record<TierKey, string> = {
  opus: 'opus 别名 / opusplan 规划阶段',
  sonnet: 'sonnet 别名 / opusplan 执行阶段',
  haiku: 'haiku 别名 + 后台轻量任务，建议选低成本模型省 token',
}

/** 去掉空白档，全空则返回 null（表示清空） */
function normalizeTiers(tiers: ModelTiers): ModelTiers | null {
  const clean: ModelTiers = {}
  for (const key of TIER_KEYS) {
    const value = (tiers[key] ?? '').trim()
    if (value) clean[key] = value
  }
  return TIER_KEYS.some((k) => clean[k]) ? clean : null
}

interface ClaudeConfigDialogProps {
  isOpen: boolean
  onClose: () => void
  config: ApiConfig
}

/** Claude Code 实际会读取的配置文件位置 */
function isValidClaudeConfigPath(p: string): boolean {
  const normalized = p.replace(/\\/g, '/')
  if (normalized.endsWith('/.claude.json')) return true
  if (normalized.endsWith('/managed-settings.json')) return true
  return /\/\.claude\/settings(\.local)?\.json$/.test(normalized)
}

/** 把用户选的路径纠正到最近的合法配置位置 */
function suggestClaudeConfigPath(p: string): string {
  const normalized = p.replace(/\\/g, '/')
  const lastSlash = normalized.lastIndexOf('/')
  const dir = lastSlash > 0 ? normalized.slice(0, lastSlash) : normalized
  // 已在 .claude 目录内但文件名不对 → 直接改文件名
  if (dir.endsWith('/.claude')) return `${dir}/settings.json`
  return `${dir}/.claude/settings.json`
}

const THINKING_MODES = ['auto', 'enabled', 'disabled'] as const
const THINKING_MODE_LABELS = ['自动（推荐）', '启用', '禁用']
const THINKING_EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const
const THINKING_EFFORT_LABELS = ['低', '中', '高（默认）', '较高', '最高']

function ClaudeConfigDialog({ isOpen, onClose, config }: ClaudeConfigDialogProps) {
  const [comparison, setComparison] = useState<ConfigComparison | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [selectedPath, setSelectedPath] = useState('')
  const [editableConfig, setEditableConfig] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [thinkingMode, setThinkingMode] = useState<'auto' | 'enabled' | 'disabled'>('auto')
  const [thinkingEffort, setThinkingEffort] = useState<'low' | 'medium' | 'high' | 'xhigh' | 'max'>('high')
  const [maxTokens, setMaxTokens] = useState<number>(8192)
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [projectPath, setProjectPath] = useState('')
  const [exportResult, setExportResult] = useState<ExportToProjectResult | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const [tiers, setTiers] = useState<ModelTiers>({})
  const [tierCustomMode, setTierCustomMode] = useState<Record<string, boolean>>({})

  const allConfigs = useConfigStore((state) => state.configs)
  const updateConfig = useConfigStore((state) => state.updateConfig)

  // 选中的配置路径；空表示用后端默认
  const activeConfigPath = selectedPath || undefined

  useEffect(() => {
    if (isOpen && config) {
      setTiers(config.tiers ? { ...config.tiers } : {})
      setTierCustomMode({})
    }
  }, [isOpen, config])

  const loadComparison = useCallback(async () => {
    if (!config) return

    setLoading(true)
    setError(null)

    try {
      const request = buildClaudeRequest(config, {
        customConfigPath: activeConfigPath,
        thinkingMode,
        thinkingEffort,
        maxTokens: maxTokens > 0 ? maxTokens : undefined,
        tiers: normalizeTiers(tiers) ?? undefined,
      })

      const result = await previewClaudeConfig(request)
      setComparison(result)
      setEditableConfig(result.new_config_json)
      setIsEditing(false)

      // 首次加载时预选推荐路径
      if (!selectedPath && result.detected_paths.length > 0) {
        const recommended = result.detected_paths.find((p, idx) =>
          idx === 0 && p.replace(' (exists)', '').includes('.claude/settings.json')
        )
        const firstExisting = result.detected_paths.find(p => p.includes('(exists)'))
        const chosen = (recommended || firstExisting || result.detected_paths[0]).replace(' (exists)', '')
        setSelectedPath(chosen)
      }
    } catch (err: any) {
      setError(err.toString())
    } finally {
      setLoading(false)
    }
  }, [config, activeConfigPath, selectedPath, thinkingMode, thinkingEffort, maxTokens, tiers])

  useEffect(() => {
    if (isOpen && config) {
      loadComparison()
    }
  }, [isOpen, config, loadComparison])

  const handleApply = async () => {
    if (!config) return

    setLoading(true)
    setError(null)

    try {
      if (isEditing) {
        await applyCustomClaudeConfig(editableConfig, activeConfigPath)
      } else {
        const normalizedTiers = normalizeTiers(tiers)
        const request = buildClaudeRequest(config, {
          customConfigPath: activeConfigPath,
          thinkingMode,
          thinkingEffort,
          maxTokens: maxTokens > 0 ? maxTokens : undefined,
          tiers: normalizedTiers ?? undefined,
        })
        await applyClaudeConfig(request)
        // 分级策略随配置档持久化，下次应用/快速应用自动带上
        if (JSON.stringify(normalizedTiers ?? null) !== JSON.stringify(config.tiers ?? null)) {
          await updateConfig(config.id, { tiers: normalizedTiers ?? undefined })
        }
      }

      setSuccess(true)

      setTimeout(() => {
        onClose()
        setSuccess(false)
      }, 2000)
    } catch (err: any) {
      setError(err.toString())
    } finally {
      setLoading(false)
    }
  }

  const handleBrowseConfigFile = async () => {
    try {
      const selected = await save({
        title: '选择配置文件位置（可新建或覆盖）',
        defaultPath: comparison?.config_path,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      })

      if (selected) {
        if (isValidClaudeConfigPath(selected)) {
          setSelectedPath(selected)
        } else {
          const suggested = suggestClaudeConfigPath(selected)
          const useSuggested = await ask(
            `所选路径不会被 Claude Code 读取：\n${selected}\n\n是否改用推荐路径？\n${suggested}`,
            {
              title: '路径可能无效',
              kind: 'warning',
              okLabel: '使用推荐路径',
              cancelLabel: '仍用原路径',
            }
          )
          setSelectedPath(useSuggested ? suggested : selected)
        }
      }
    } catch (err: any) {
      setError(err.toString())
    }
  }

  const handleToggleEdit = () => {
    if (!isEditing && comparison) {
      setEditableConfig(comparison.new_config_json)
    }
    setIsEditing(!isEditing)
  }

  const handleBrowseProject = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: '选择项目目录',
      })

      if (selected && typeof selected === 'string') {
        setProjectPath(selected)
      }
    } catch (err: any) {
      setExportError(err.toString())
    }
  }

  const handleExportToProject = async () => {
    if (!config || !projectPath) return

    setLoading(true)
    setExportError(null)
    setExportResult(null)

    try {
      const request = buildClaudeRequest(config, {
        thinkingMode,
        thinkingEffort,
        maxTokens: maxTokens > 0 ? maxTokens : undefined,
        tiers: normalizeTiers(tiers) ?? undefined,
      })

      const result = await exportToProject(request, projectPath)
      setExportResult(result)

      setTimeout(() => {
        setShowExportDialog(false)
        setExportResult(null)
        setProjectPath('')
      }, 3000)
    } catch (err: any) {
      setExportError(err.toString())
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen || !config) return null

  // 检测路径解析
  const detected = (comparison?.detected_paths || []).map((path, idx) => {
    const isExists = path.includes('(exists)')
    const cleanPath = path.replace(' (exists)', '')
    const isRecommended = idx === 0 && cleanPath.includes('.claude/settings.json')
    return { cleanPath, isExists, isRecommended }
  })
  const detectedCleanPaths = detected.map(d => d.cleanPath)
  const isCustomPath = selectedPath !== '' && !detectedCleanPaths.includes(selectedPath)

  const modeIdx = Math.max(0, THINKING_MODES.indexOf(thinkingMode))
  const effortIdx = Math.max(0, THINKING_EFFORTS.indexOf(thinkingEffort))
  const modelOptions = Array.from(
    new Set(allConfigs.map((c) => c.model).filter((m) => !!m))
  )

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-content" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h2 className="dialog-title">应用至 Claude Code</h2>
          <button className="dialog-close" onClick={onClose}>x</button>
        </div>

        <div className="dialog-body">
          <div className="config-path-section">
            {comparison && detected.length > 0 && (
              <div className="detected-paths">
                <div className="detected-paths-header">
                  <span className="detected-paths-label">配置文件路径：</span>
                  <span className="detected-paths-hint">点选目标路径 · 绿色表示已存在</span>
                </div>
                <div className="path-radio-list">
                  {detected.map((d, idx) => {
                    const isActive = selectedPath === d.cleanPath
                    return (
                      <label
                        key={idx}
                        className={`path-radio-item ${isActive ? 'active' : ''} ${d.isExists ? 'exists' : ''}`}
                        title={d.isRecommended ? '推荐：Claude Code 官方配置' : ''}
                      >
                        <input
                          type="radio"
                          name="config-path"
                          checked={isActive}
                          onChange={() => setSelectedPath(d.cleanPath)}
                        />
                        <span className="path-radio-dot">{isActive ? '●' : '○'}</span>
                        <span className="path-indicator">{d.isExists ? '✓' : '○'}</span>
                        <span className="path-text">{d.cleanPath}</span>
                        {d.isRecommended && <span className="path-badge">推荐</span>}
                      </label>
                    )
                  })}
                  <div
                    className={`path-radio-item ${isCustomPath ? 'active' : ''}`}
                    onClick={handleBrowseConfigFile}
                  >
                    <span className="path-radio-dot">{isCustomPath ? '●' : '○'}</span>
                    <span className="path-indicator">📂</span>
                    <span className="path-text">{isCustomPath ? selectedPath : '自定义路径（选择或新建）…'}</span>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={(e) => { e.stopPropagation(); handleBrowseConfigFile() }}
                    >
                      浏览…
                    </button>
                  </div>
                  {isCustomPath && !isValidClaudeConfigPath(selectedPath) && (
                    <div className="path-warning">
                      ⚠ 该路径不会被 Claude Code 读取，配置写入后不会生效。建议重新选择到某个项目的
                      .claude/settings.json 或 ~/.claude/settings.json。
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {!loading && !success && (
            <div className="advanced-section">
              <div className="advanced-fields">
                <div className="slider-field">
                  <div className="slider-header">
                    <span className="field-label">思考模式</span>
                    <span className="slider-value">{THINKING_MODE_LABELS[modeIdx]}</span>
                  </div>
                  <input
                    type="range"
                    className="slider"
                    min={0}
                    max={2}
                    step={1}
                    value={modeIdx}
                    onChange={(e) => setThinkingMode(THINKING_MODES[Number(e.target.value)])}
                    style={{ ['--fill' as any]: (modeIdx / 2) * 100 }}
                  />
                  <div className="slider-marks">
                    {THINKING_MODE_LABELS.map((label, i) => (
                      <span key={i} className={`slider-mark ${i === modeIdx ? 'active' : ''}`}>{label}</span>
                    ))}
                  </div>
                  <span className="field-hint">控制模型何时展示推理过程</span>
                </div>

                <div className="slider-field">
                  <div className="slider-header">
                    <span className="field-label">思考强度</span>
                    <span className="slider-value">{THINKING_EFFORT_LABELS[effortIdx]}</span>
                  </div>
                  <input
                    type="range"
                    className="slider"
                    min={0}
                    max={4}
                    step={1}
                    value={effortIdx}
                    onChange={(e) => setThinkingEffort(THINKING_EFFORTS[Number(e.target.value)])}
                    style={{ ['--fill' as any]: (effortIdx / 4) * 100 }}
                  />
                  <div className="slider-marks">
                    {THINKING_EFFORT_LABELS.map((label, i) => (
                      <span key={i} className={`slider-mark ${i === effortIdx ? 'active' : ''}`}>{label}</span>
                    ))}
                  </div>
                  <span className="field-hint">复杂任务的推理深度</span>
                </div>

                <div className="slider-field">
                  <div className="slider-header">
                    <span className="field-label">最大 Tokens</span>
                    <span className="slider-value">{maxTokens}</span>
                  </div>
                  <input
                    type="range"
                    className="slider"
                    min={1024}
                    max={200000}
                    step={1024}
                    value={maxTokens}
                    onChange={(e) => setMaxTokens(Number(e.target.value))}
                    style={{ ['--fill' as any]: ((maxTokens - 1024) / (200000 - 1024)) * 100 }}
                  />
                  <div className="slider-marks">
                    <span className="slider-mark">1024</span>
                    <span className="slider-mark">{maxTokens}</span>
                    <span className="slider-mark">200000</span>
                  </div>
                  <span className="field-hint">最大响应长度（1024-200000）</span>
                </div>
              </div>
            </div>
          )}

          {!loading && !success && (
            <div className="tier-section">
              <div className="tier-section-header">
                <span className="field-label">模型分级策略</span>
                <span className="field-hint">
                  对应 Claude Code 的 opus / sonnet / haiku 模型别名；未设置时后台任务将回退到主模型
                </span>
              </div>
              {TIER_KEYS.map((tier) => {
                const value = (tiers[tier] ?? '').trim()
                const inOptions = modelOptions.includes(value)
                const isCustom =
                  tierCustomMode[tier] === true || (value !== '' && !inOptions)
                return (
                  <div className="tier-row" key={tier}>
                    <span className={`tier-name tier-${tier}`}>{tier}</span>
                    <select
                      className="field-select"
                      value={isCustom ? '__custom' : value}
                      onChange={(e) => {
                        const next = e.target.value
                        if (next === '__custom') {
                          setTierCustomMode((m) => ({ ...m, [tier]: true }))
                        } else {
                          setTierCustomMode((m) => ({ ...m, [tier]: false }))
                          setTiers((t) => ({ ...t, [tier]: next === '' ? undefined : next }))
                        }
                      }}
                    >
                      <option value="">不设置（回退主模型）</option>
                      {modelOptions.map((m) => (
                        <option key={m} value={m}>
                          {m}
                          {m === config.model ? '（本档主模型）' : ''}
                        </option>
                      ))}
                      <option value="__custom">自定义模型名…</option>
                    </select>
                    {isCustom && (
                      <input
                        className="field-input tier-custom-input"
                        placeholder="输入模型名"
                        value={tiers[tier] ?? ''}
                        onChange={(e) =>
                          setTiers((t) => ({ ...t, [tier]: e.target.value }))
                        }
                      />
                    )}
                    <span className="tier-hint">{TIER_HINTS[tier]}</span>
                  </div>
                )
              })}
            </div>
          )}

          {loading && !comparison && (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>正在加载配置…</p>
            </div>
          )}

          {error && (
            <div className="error-state">
              <p className="error-message">{error}</p>
              <button className="btn btn-secondary" onClick={loadComparison}>
                重试
              </button>
            </div>
          )}

          {success && (
            <div className="success-state">
              <div className="success-icon">✓</div>
              <p>配置应用成功！</p>
              <p className="success-detail">Claude Code 下次启动时将使用新配置。</p>
            </div>
          )}

          {comparison && !loading && !success && (
            <>
              <div className="config-section">
                <h3 className="section-title">当前 Claude Code 配置</h3>
                <div className="config-block">
                  <pre className="config-json">{comparison.current_config_json || '{}'}</pre>
                </div>
              </div>

              <div className="config-arrow">将更改为</div>

              <div className="config-section">
                <div className="section-title-row">
                  <h3 className="section-title">新配置（可编辑）</h3>
                  <button
                    className="btn-icon btn-edit-config"
                    onClick={handleToggleEdit}
                    title={isEditing ? '预览' : '编辑'}
                  >
                    {isEditing ? '完成' : '编辑'}
                  </button>
                </div>

                {isEditing ? (
                  <textarea
                    className="config-json-editor"
                    value={editableConfig}
                    onChange={(e) => setEditableConfig(e.target.value)}
                    spellCheck={false}
                  />
                ) : (
                  <div className="config-block highlight">
                    <pre className="config-json">{editableConfig}</pre>
                  </div>
                )}
              </div>

              <div className="config-info">
                <p className="info-text">
                  <strong>配置文件：</strong> {comparison.config_path}
                </p>
                <p className="info-text">
                  <strong>来源：</strong> {config.name} ({config.model})
                </p>
                {config.lastLatency !== undefined && (
                  <p className="info-text">
                    <strong>延迟：</strong> {config.lastLatency}ms
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        <div className="dialog-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={loading}>
            取消
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => setShowExportDialog(true)}
            disabled={loading || success}
          >
            导出至项目
          </button>
          <button
            className="btn btn-primary"
            onClick={handleApply}
            disabled={loading || success}
          >
            {loading ? '应用中…' : success ? '已应用！' : '应用更改'}
          </button>
        </div>
      </div>

      {showExportDialog && (
        <div className="dialog-overlay" onClick={() => setShowExportDialog(false)}>
          <div className="dialog-content export-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <h2 className="dialog-title">导出至项目</h2>
              <button className="dialog-close" onClick={() => setShowExportDialog(false)}>x</button>
            </div>

            <div className="dialog-body">
              {!exportResult ? (
                <>
                  <div className="field-group">
                    <label className="field-label">项目目录</label>
                    <div className="path-input-row">
                      <input
                        type="text"
                        className="field-input"
                        value={projectPath}
                        onChange={(e) => setProjectPath(e.target.value)}
                        placeholder="选择项目目录…"
                        readOnly
                      />
                      <button className="btn btn-secondary" onClick={handleBrowseProject}>
                        浏览…
                      </button>
                    </div>
                    <span className="field-hint">
                      配置将保存至：{projectPath
                        ? `${projectPath}/.claude/${config.apiKey ? 'settings.local.json' : 'settings.json'}`
                        : '（请选择目录）'}
                      {config.apiKey && '（含 API key，自动加入 git 忽略）'}
                    </span>
                  </div>

                  {exportError && (
                    <div className="error-state">
                      <p className="error-message">{exportError}</p>
                    </div>
                  )}

                  <div className="export-info">
                    <h3 className="section-title">将导出：</h3>
                    <ul className="export-items">
                      <li><strong>模型：</strong> {config.model}</li>
                      <li><strong>端点：</strong> {config.endpoint}</li>
                      <li><strong>思考模式：</strong> {THINKING_MODE_LABELS[modeIdx]}</li>
                      <li><strong>思考强度：</strong> {THINKING_EFFORT_LABELS[effortIdx]}</li>
                      <li><strong>最大 Tokens：</strong> {maxTokens}</li>
                    </ul>
                  </div>
                </>
              ) : (
                <div className="success-state">
                  <div className="success-icon">✓</div>
                  <p>配置导出成功！</p>
                  <p className="success-detail">
                    {exportResult.created_directory && '已创建 .claude 目录并 '}
                    保存至：<code>{exportResult.config_path}</code>
                  </p>
                  {exportResult.used_local_settings && (
                    <p className="success-hint">
                      因包含 API key，已写入 settings.local.json
                      {exportResult.gitignore_updated && '，并在 .claude/.gitignore 中忽略该文件'}
                      ，不会被提交到 git。
                    </p>
                  )}
                  <p className="success-hint">
                    在此项目目录中启动 Claude Code 即可使用该配置。
                  </p>
                </div>
              )}
            </div>

            <div className="dialog-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setShowExportDialog(false)}
                disabled={loading}
              >
                取消
              </button>
              <button
                className="btn btn-primary"
                onClick={handleExportToProject}
                disabled={loading || !projectPath || !!exportResult}
              >
                {loading ? '导出中…' : '导出'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ClaudeConfigDialog
