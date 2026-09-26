import { useState, useEffect, useCallback, useRef } from 'react'
import { ApiConfig, ConfigComparison, ModelTiers, ProjectEntry, TargetConfigInfo } from '../types'
import { useConfigStore } from '../store/configStore'
import {
  applyClaudeConfig,
  exportToProject,
  buildClaudeRequest,
  previewClaudeConfig,
  listProjects,
  registerProject,
  removeProject,
  createProjectDir,
  initGitRepo,
  openTerminalAt,
  scanClaudeTarget,
} from '../services/tauriCommands'
import { open } from '@tauri-apps/plugin-dialog'
import ConfigOverviewDialog from './ConfigOverviewDialog'
import {
  THINKING_MODES,
  THINKING_MODE_LABELS,
  THINKING_EFFORTS,
  THINKING_EFFORT_LABELS,
  TIER_KEYS,
  TIER_HINTS,
  type TierKey,
} from '../utils/constants'

type ThinkingMode = (typeof THINKING_MODES)[number]
type ThinkingEffort = (typeof THINKING_EFFORTS)[number]

interface TargetRow {
  key: string
  label: string
  /** current effective model or 未配置 */
  sub: string
  /** undefined = global */
  path?: string
  info: TargetConfigInfo
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

function ProjectApiConfigView() {
  const configs = useConfigStore((state) => state.configs)
  const updateConfig = useConfigStore((state) => state.updateConfig)

  const [targets, setTargets] = useState<TargetRow[]>([])
  const [activeTarget, setActiveTarget] = useState('global')
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null)
  const [loadingTargets, setLoadingTargets] = useState(true)
  const [applying, setApplying] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [viewError, setViewError] = useState<string | null>(null)
  const [showOverview, setShowOverview] = useState(false)
  const [showRegisterForm, setShowRegisterForm] = useState(false)
  const [newProjectParent, setNewProjectParent] = useState('')
  const [newProjectName, setNewProjectName] = useState('')
  const [registering, setRegistering] = useState(false)
  const [appliedProjectPath, setAppliedProjectPath] = useState<string | null>(null)
  const [confirmRemovePath, setConfirmRemovePath] = useState<string | null>(null)

  // 详细配置（初值来自配置档持久化的 applySettings/tiers）
  const [thinkingMode, setThinkingMode] = useState<ThinkingMode>('auto')
  const [thinkingEffort, setThinkingEffort] = useState<ThinkingEffort>('high')
  const [maxTokens, setMaxTokens] = useState<number>(8192)
  const [tiers, setTiers] = useState<ModelTiers>({})
  const [tierCustomMode, setTierCustomMode] = useState<Record<string, boolean>>({})

  const [preview, setPreview] = useState<ConfigComparison | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const refreshTargets = useCallback(async () => {
    const projects: ProjectEntry[] = await listProjects()
    const infos = await Promise.all([
      scanClaudeTarget(undefined),
      ...projects.map((p) => scanClaudeTarget(p.path)),
    ])
    const [globalInfo, ...projectInfos] = infos
    setTargets([
      {
        key: 'global',
        label: '全局配置',
        sub: globalInfo.model ?? '未配置',
        info: globalInfo,
      },
      ...projects.map((p, i) => ({
        key: p.path,
        label: p.name,
        sub: projectInfos[i].model ?? '未配置',
        path: p.path,
        info: projectInfos[i],
      })),
    ])
  }, [])

  useEffect(() => {
    refreshTargets()
      .catch((err) => setViewError(err.toString()))
      .finally(() => setLoadingTargets(false))
  }, [refreshTargets])

  const activeTargetRow = targets.find((t) => t.key === activeTarget)
  const activeInfo = activeTargetRow?.info
  const selectedProfile = configs.find((c) => c.id === selectedProfileId) ?? null

  // 自动选中配置档：优先与目标当前生效模型匹配的档位，其次保留已有选择，最后取第一个
  const autoSelectProfile = useCallback(
    (t?: TargetRow) => {
      if (configs.length === 0) {
        setSelectedProfileId(null)
        return
      }
      const match = t?.info.model ? configs.find((c) => c.model === t.info.model) : undefined
      setSelectedProfileId((prev) =>
        match?.id ?? (prev && configs.some((c) => c.id === prev) ? prev : configs[0].id)
      )
    },
    [configs]
  )

  // 首次进入：目标与配置档都就绪后自动展开详细信息
  const didAutoSelect = useRef(false)
  useEffect(() => {
    if (didAutoSelect.current || loadingTargets || configs.length === 0) return
    didAutoSelect.current = true
    autoSelectProfile(targets.find((t) => t.key === activeTarget))
  }, [loadingTargets, configs, targets, activeTarget, autoSelectProfile])

  // 切换选中配置档时，从持久化值恢复详细配置
  useEffect(() => {
    if (!selectedProfile) return
    const stored = selectedProfile.applySettings
    setThinkingMode(stored?.thinkingMode ?? 'auto')
    setThinkingEffort(stored?.thinkingEffort ?? 'high')
    setMaxTokens(stored?.maxTokens ?? 8192)
    setTiers(selectedProfile.tiers ? { ...selectedProfile.tiers } : {})
    setTierCustomMode({})
  }, [selectedProfileId]) // eslint-disable-line react-hooks/exhaustive-deps

  // 详细配置变更后 debounce 刷新 JSON 预览
  useEffect(() => {
    if (!selectedProfile) {
      setPreview(null)
      return
    }
    if (previewTimer.current) clearTimeout(previewTimer.current)
    previewTimer.current = setTimeout(async () => {
      setPreviewLoading(true)
      try {
        const request = buildClaudeRequest(selectedProfile, {
          // 项目目标：以项目内的 settings.json 作为"当前配置"参照
          customConfigPath: activeTargetRow?.path
            ? `${activeTargetRow.path}/.claude/settings.json`
            : undefined,
          thinkingMode,
          thinkingEffort,
          maxTokens: maxTokens > 0 ? maxTokens : undefined,
          tiers: normalizeTiers(tiers) ?? undefined,
        })
        const result = await previewClaudeConfig(request)
        setPreview(result)
      } catch (err: any) {
        setViewError(err.toString())
      } finally {
        setPreviewLoading(false)
      }
    }, 350)
    return () => {
      if (previewTimer.current) clearTimeout(previewTimer.current)
    }
  }, [selectedProfile, activeTarget, thinkingMode, thinkingEffort, maxTokens, tiers])

  const showToast = (msg: string, duration = 2500) => {
    setToast(msg)
    setTimeout(() => setToast(null), duration)
  }

  const finishRegister = async (path: string) => {
    await refreshTargets()
    setActiveTarget(path)
    setAppliedProjectPath(null)
    setShowRegisterForm(false)
    setNewProjectParent('')
    setNewProjectName('')
  }

  const handlePickExistingDir = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: '选择要登记的项目目录',
      })
      if (selected && typeof selected === 'string') {
        await registerProject(selected)
        await finishRegister(selected)
      }
    } catch (err: any) {
      setViewError(err.toString())
    }
  }

  const handlePickParentDir = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: '选择新项目的父目录',
      })
      if (selected && typeof selected === 'string') {
        setNewProjectParent(selected)
      }
    } catch (err: any) {
      setViewError(err.toString())
    }
  }

  const handleCreateAndRegister = async () => {
    if (!newProjectParent || !newProjectName.trim() || registering) return
    setRegistering(true)
    setViewError(null)
    try {
      const entry = await createProjectDir(newProjectParent, newProjectName.trim())
      await finishRegister(entry.path)
      showToast(`已创建并登记 ${entry.name}`)
    } catch (err: any) {
      setViewError(err.toString())
    } finally {
      setRegistering(false)
    }
  }

  const handleRemoveTarget = async (path: string) => {
    setViewError(null)
    try {
      await removeProject(path)
      if (activeTarget === path) setActiveTarget('global')
      if (appliedProjectPath === path) setAppliedProjectPath(null)
      await refreshTargets()
      showToast('已移除登记（磁盘配置文件未删除）')
    } catch (err: any) {
      setViewError(err.toString())
    } finally {
      setConfirmRemovePath(null)
    }
  }

  const handleGitInit = async () => {
    if (!appliedProjectPath) return
    setViewError(null)
    try {
      const created = await initGitRepo(appliedProjectPath)
      showToast(created ? '已初始化 git 仓库' : '已是 git 仓库，无需初始化')
    } catch (err: any) {
      setViewError(err.toString())
    }
  }

  const handleOpenTerminal = async () => {
    if (!appliedProjectPath) return
    setViewError(null)
    try {
      await openTerminalAt(appliedProjectPath)
      showToast('已打开终端，请在其中运行 claude', 3000)
    } catch (err: any) {
      setViewError(err.toString())
    }
  }

  const handleApply = async () => {
    if (!selectedProfile || !activeTargetRow || applying) return

    setApplying(true)
    setViewError(null)
    try {
      const normalizedTiers = normalizeTiers(tiers)
      const request = buildClaudeRequest(selectedProfile, {
        thinkingMode,
        thinkingEffort,
        maxTokens: maxTokens > 0 ? maxTokens : undefined,
        tiers: normalizedTiers ?? undefined,
      })
      if (activeTargetRow.path) {
        await exportToProject(request, activeTargetRow.path)
        setAppliedProjectPath(activeTargetRow.path)
      } else {
        await applyClaudeConfig(request)
        setAppliedProjectPath(null)
      }

      // 详细配置随配置档持久化，下次自动带上
      const storedSettings = selectedProfile.applySettings
      const settingsChanged =
        (storedSettings?.thinkingMode ?? 'auto') !== thinkingMode ||
        (storedSettings?.thinkingEffort ?? 'high') !== thinkingEffort ||
        (storedSettings?.maxTokens ?? 8192) !== maxTokens
      const tiersChanged =
        JSON.stringify(normalizedTiers ?? null) !== JSON.stringify(selectedProfile.tiers ?? null)
      if (settingsChanged || tiersChanged) {
        await updateConfig(selectedProfile.id, {
          tiers: normalizedTiers ?? undefined,
          applySettings: { thinkingMode, thinkingEffort, maxTokens },
        })
      }

      await refreshTargets()
      showToast(
        `已应用「${selectedProfile.name}」至${
          activeTargetRow.path ? ` ${activeTargetRow.label}` : '全局配置'
        }`
      )
    } catch (err: any) {
      setViewError(err.toString())
    } finally {
      setApplying(false)
    }
  }

  const modelOptions = Array.from(new Set(configs.map((c) => c.model).filter((m) => !!m)))

  return (
    <div className="project-api-view">
      {/* 左栏：应用目标 */}
      <aside className="pav-left">
        <div className="pav-left-header">应用目标</div>
        <div className="pav-target-list">
          {loadingTargets ? (
            <div className="cascade-loading">读取中…</div>
          ) : (
            targets.map((t) => (
              <div
                key={t.key}
                className={`pav-target-row ${activeTarget === t.key ? 'active' : ''}`}
              >
                <button
                  className="pav-target"
                  onClick={() => {
                    setActiveTarget(t.key)
                    setAppliedProjectPath(null)
                    setConfirmRemovePath(null)
                    autoSelectProfile(t)
                  }}
                >
                  <span className="pav-target-label">{t.label}</span>
                  <span className={`pav-target-sub ${t.info.model ? '' : 'muted'}`}>{t.sub}</span>
                  {t.info.model && <span className="pav-target-check">✓</span>}
                </button>
                {t.path &&
                  (confirmRemovePath === t.path ? (
                    <span className="pav-remove-confirm">
                      <button
                        className="pav-remove-yes"
                        title="仅移除登记，不删除磁盘文件"
                        onClick={() => handleRemoveTarget(t.path!)}
                      >
                        移除
                      </button>
                      <button
                        className="pav-remove-no"
                        onClick={() => setConfirmRemovePath(null)}
                      >
                        取消
                      </button>
                    </span>
                  ) : (
                    <button
                      className="pav-target-remove"
                      title="移除登记（不删除磁盘文件）"
                      onClick={(e) => {
                        e.stopPropagation()
                        setConfirmRemovePath(t.path!)
                      }}
                    >
                      ✕
                    </button>
                  ))}
              </div>
            ))
          )}
        </div>
        <div className="pav-left-actions">
          <button className="btn btn-secondary pav-action-btn" onClick={() => setShowRegisterForm((v) => !v)}>
            ＋ 登记新项目…
          </button>
          <button className="btn btn-secondary pav-action-btn" onClick={() => setShowOverview(true)}>
            ⚙ 配置总览
          </button>
        </div>

        {showRegisterForm && (
          <div className="pav-register-form">
            <div className="field-group">
              <label className="field-label">方式一：选择已有目录</label>
              <button className="btn btn-secondary" onClick={handlePickExistingDir}>
                选择目录并登记…
              </button>
            </div>
            <div className="field-group">
              <label className="field-label">方式二：新建空项目目录</label>
              <div className="path-input-row">
                <input
                  type="text"
                  className="field-input"
                  value={newProjectParent}
                  readOnly
                  placeholder="父目录…"
                />
                <button className="btn btn-secondary" onClick={handlePickParentDir}>
                  浏览…
                </button>
              </div>
              <input
                type="text"
                className="field-input"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="项目名（将作为新文件夹名）"
              />
              <button
                className="btn btn-primary"
                disabled={!newProjectParent || !newProjectName.trim() || registering}
                onClick={handleCreateAndRegister}
              >
                {registering ? '创建中…' : '创建并登记'}
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* 右栏：配置工作区 */}
      <section className="pav-right">
        <div className="pav-right-header">
          <span className="pav-right-title">
            应用至：{activeTargetRow?.label ?? '—'}
          </span>
          {activeInfo?.full_path && (
            <span className="overview-badge shared">
              当前 {activeInfo.source_file}
            </span>
          )}
          {activeInfo?.model && (
            <span className="pav-right-current">生效模型：{activeInfo.model}</span>
          )}
        </div>

        {configs.length === 0 ? (
          <div className="pav-empty">
            暂无模型配置档，请先在「模型测试」标签页添加资源。
          </div>
        ) : (
          <>
            <div className="pav-profile-grid">
              {configs.map((c) => (
                <button
                  key={c.id}
                  className={`pav-profile ${selectedProfileId === c.id ? 'selected' : ''}`}
                  disabled={applying}
                  onClick={() => setSelectedProfileId(selectedProfileId === c.id ? null : c.id)}
                >
                  <span className="pav-profile-name">{c.name}</span>
                  <span className="pav-profile-model">{c.model}</span>
                  {c.tiers?.haiku && (
                    <span className="cascade-tier-dot" title={`haiku 档：${c.tiers.haiku}`}>
                      分级
                    </span>
                  )}
                  {activeInfo?.model === c.model && <span className="pav-target-check">✓</span>}
                </button>
              ))}
            </div>

            {selectedProfile && (
              <ProfileDetailPanel
                profile={selectedProfile}
                thinkingMode={thinkingMode}
                thinkingEffort={thinkingEffort}
                maxTokens={maxTokens}
                tiers={tiers}
                tierCustomMode={tierCustomMode}
                modelOptions={modelOptions}
                preview={preview}
                previewLoading={previewLoading}
                isGlobalTarget={!activeTargetRow?.path}
                applying={applying}
                targetLabel={activeTargetRow?.label ?? '—'}
                onThinkingMode={setThinkingMode}
                onThinkingEffort={setThinkingEffort}
                onMaxTokens={setMaxTokens}
                onTiers={setTiers}
                onTierCustomMode={setTierCustomMode}
                onApply={handleApply}
              />
            )}
          </>
        )}

        {viewError && <div className="cascade-error">{viewError}</div>}

        {appliedProjectPath && (
          <div className="pav-next-row">
            <span className="pav-next-label">下一步</span>
            <button className="btn btn-secondary" onClick={handleGitInit}>
              初始化 git
            </button>
            <button className="btn btn-secondary" onClick={handleOpenTerminal}>
              打开终端启动 Claude Code
            </button>
          </div>
        )}
      </section>

      {toast && <div className="cascade-toast pav-toast">{toast}</div>}
      {showOverview && (
        <ConfigOverviewDialog
          onClose={() => setShowOverview(false)}
          onChanged={refreshTargets}
        />
      )}
    </div>
  )
}

interface ProfileDetailPanelProps {
  profile: ApiConfig
  thinkingMode: ThinkingMode
  thinkingEffort: ThinkingEffort
  maxTokens: number
  tiers: ModelTiers
  tierCustomMode: Record<string, boolean>
  modelOptions: string[]
  preview: ConfigComparison | null
  previewLoading: boolean
  isGlobalTarget: boolean
  applying: boolean
  targetLabel: string
  onThinkingMode: (v: ThinkingMode) => void
  onThinkingEffort: (v: ThinkingEffort) => void
  onMaxTokens: (v: number) => void
  onTiers: (fn: (t: ModelTiers) => ModelTiers) => void
  onTierCustomMode: (fn: (m: Record<string, boolean>) => Record<string, boolean>) => void
  onApply: () => void
}

function ProfileDetailPanel({
  profile,
  thinkingMode,
  thinkingEffort,
  maxTokens,
  tiers,
  tierCustomMode,
  modelOptions,
  preview,
  previewLoading,
  isGlobalTarget,
  applying,
  targetLabel,
  onThinkingMode,
  onThinkingEffort,
  onMaxTokens,
  onTiers,
  onTierCustomMode,
  onApply,
}: ProfileDetailPanelProps) {
  const [showPreview, setShowPreview] = useState(true)
  const modeIdx = Math.max(0, THINKING_MODES.indexOf(thinkingMode))
  const effortIdx = Math.max(0, THINKING_EFFORTS.indexOf(thinkingEffort))

  return (
    <div className="pav-detail">
      <div className="pav-detail-header">
        <span className="pav-detail-title">详细配置：{profile.name}</span>
        <span className="field-hint">
          {profile.endpoint || '默认端点'} · 应用时自动保存到该配置档
        </span>
      </div>

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
            onChange={(e) => onThinkingMode(THINKING_MODES[Number(e.target.value)])}
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
            onChange={(e) => onThinkingEffort(THINKING_EFFORTS[Number(e.target.value)])}
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
            onChange={(e) => onMaxTokens(Number(e.target.value))}
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

      <div className="tier-section">
        <div className="tier-section-header">
          <span className="field-label">模型分级策略</span>
          <span className="field-hint">
            对应 Claude Code 的 opus / sonnet / haiku 模型别名；未设置时后台任务将回退到主模型
          </span>
        </div>
        {TIER_KEYS.map((tier: TierKey) => {
          const value = (tiers[tier] ?? '').trim()
          const inOptions = modelOptions.includes(value)
          const isCustom = tierCustomMode[tier] === true || (value !== '' && !inOptions)
          return (
            <div className="tier-row" key={tier}>
              <span className={`tier-name tier-${tier}`}>{tier}</span>
              <select
                className="field-select"
                value={isCustom ? '__custom' : value}
                onChange={(e) => {
                  const next = e.target.value
                  if (next === '__custom') {
                    onTierCustomMode((m) => ({ ...m, [tier]: true }))
                  } else {
                    onTierCustomMode((m) => ({ ...m, [tier]: false }))
                    onTiers((t) => ({ ...t, [tier]: next === '' ? undefined : next }))
                  }
                }}
              >
                <option value="">不设置（回退主模型）</option>
                {modelOptions.map((m) => (
                  <option key={m} value={m}>
                    {m}
                    {m === profile.model ? '（本档主模型）' : ''}
                  </option>
                ))}
                <option value="__custom">自定义模型名…</option>
              </select>
              {isCustom && (
                <input
                  className="field-input tier-custom-input"
                  placeholder="输入模型名"
                  value={tiers[tier] ?? ''}
                  onChange={(e) => onTiers((t) => ({ ...t, [tier]: e.target.value }))}
                />
              )}
              <span className="tier-hint">{TIER_HINTS[tier]}</span>
            </div>
          )
        })}
      </div>

      <div className="pav-preview-section">
        <button
          className="pav-preview-toggle"
          onClick={() => setShowPreview((v) => !v)}
        >
          {showPreview ? '▾' : '▸'} 配置 JSON 预览
          {previewLoading && <span className="pav-preview-loading">更新中…</span>}
        </button>
        {showPreview && preview && (
          <div className="pav-preview-columns">
            {isGlobalTarget && (
              <div className="config-section">
                <h3 className="section-title">当前 Claude Code 配置</h3>
                <div className="config-block">
                  <pre className="config-json">{preview.current_config_json || '{}'}</pre>
                </div>
              </div>
            )}
            <div className="config-section">
              <h3 className="section-title">将写入的新配置</h3>
              <div className="config-block highlight">
                <pre className="config-json">{preview.new_config_json}</pre>
              </div>
              {preview.config_path && (
                <p className="info-text">
                  <strong>{isGlobalTarget ? '配置文件' : '预览参照'}：</strong>
                  {preview.config_path}
                  {!isGlobalTarget && '（含密钥时实际写入 settings.local.json）'}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="pav-apply-row">
        <button className="btn btn-primary pav-apply-btn" disabled={applying} onClick={onApply}>
          {applying ? '应用中…' : `确认应用「${profile.name}」至「${targetLabel}」`}
        </button>
      </div>
    </div>
  )
}

export default ProjectApiConfigView
