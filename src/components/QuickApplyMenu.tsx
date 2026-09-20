import { useState, useEffect, useCallback } from 'react'
import { ProjectEntry, TargetConfigInfo } from '../types'
import { useConfigStore } from '../store/configStore'
import {
  applyClaudeConfig,
  exportToProject,
  buildClaudeRequest,
  listProjects,
  registerProject,
  createProjectDir,
  initGitRepo,
  openTerminalAt,
  scanClaudeTarget,
} from '../services/tauriCommands'
import { open } from '@tauri-apps/plugin-dialog'
import ConfigOverviewDialog from './ConfigOverviewDialog'

interface QuickApplyMenuProps {
  onClose: () => void
}

interface TargetRow {
  key: string
  label: string
  /** current effective model or 未配置 */
  sub: string
  /** undefined = global */
  path?: string
  info: TargetConfigInfo
}

function QuickApplyMenu({ onClose }: QuickApplyMenuProps) {
  const configs = useConfigStore((state) => state.configs)
  const [targets, setTargets] = useState<TargetRow[]>([])
  const [activeTarget, setActiveTarget] = useState('global')
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null)
  const [loadingTargets, setLoadingTargets] = useState(true)
  const [applyingId, setApplyingId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [menuError, setMenuError] = useState<string | null>(null)
  const [showOverview, setShowOverview] = useState(false)
  const [showRegisterForm, setShowRegisterForm] = useState(false)
  const [newProjectParent, setNewProjectParent] = useState('')
  const [newProjectName, setNewProjectName] = useState('')
  const [registering, setRegistering] = useState(false)
  const [appliedProjectPath, setAppliedProjectPath] = useState<string | null>(null)

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
      .catch((err) => setMenuError(err.toString()))
      .finally(() => setLoadingTargets(false))
  }, [refreshTargets])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

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
      setMenuError(err.toString())
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
      setMenuError(err.toString())
    }
  }

  const handleCreateAndRegister = async () => {
    if (!newProjectParent || !newProjectName.trim() || registering) return
    setRegistering(true)
    setMenuError(null)
    try {
      const entry = await createProjectDir(newProjectParent, newProjectName.trim())
      await finishRegister(entry.path)
      setToast(`已创建并登记 ${entry.name}`)
      setTimeout(() => setToast(null), 2500)
    } catch (err: any) {
      setMenuError(err.toString())
    } finally {
      setRegistering(false)
    }
  }

  const handleGitInit = async () => {
    if (!appliedProjectPath) return
    setMenuError(null)
    try {
      const created = await initGitRepo(appliedProjectPath)
      setToast(created ? '已初始化 git 仓库' : '已是 git 仓库，无需初始化')
      setTimeout(() => setToast(null), 2500)
    } catch (err: any) {
      setMenuError(err.toString())
    }
  }

  const handleOpenTerminal = async () => {
    if (!appliedProjectPath) return
    setMenuError(null)
    try {
      await openTerminalAt(appliedProjectPath)
      setToast('已打开终端，请在其中运行 claude')
      setTimeout(() => setToast(null), 3000)
    } catch (err: any) {
      setMenuError(err.toString())
    }
  }

  const handleApply = async (configId: string) => {
    const target = targets.find((t) => t.key === activeTarget)
    const profile = configs.find((c) => c.id === configId)
    if (!target || !profile || applyingId) return

    setApplyingId(configId)
    setMenuError(null)
    try {
      const request = buildClaudeRequest(profile)
      if (target.path) {
        await exportToProject(request, target.path)
        setAppliedProjectPath(target.path)
      } else {
        await applyClaudeConfig(request)
        setAppliedProjectPath(null)
      }
      await refreshTargets()
      setToast(`已应用「${profile.name}」至${target.path ? ` ${target.label}` : '全局配置'}`)
      setTimeout(() => setToast(null), 2500)
    } catch (err: any) {
      setMenuError(err.toString())
    } finally {
      setApplyingId(null)
    }
  }

  const activeInfo = targets.find((t) => t.key === activeTarget)?.info

  return (
    <div className="dialog-overlay cascade-overlay" onClick={onClose}>
      <div className="cascade-menu" onClick={(e) => e.stopPropagation()}>
        <div className="cascade-left">
          {loadingTargets ? (
            <div className="cascade-loading">读取中…</div>
          ) : (
            targets.map((t) => (
              <button
                key={t.key}
                className={`cascade-target ${activeTarget === t.key ? 'active' : ''}`}
                onClick={() => {
                  setActiveTarget(t.key)
                  setAppliedProjectPath(null)
                }}
              >
                <span className="cascade-target-label">{t.label}</span>
                <span className={`cascade-target-sub ${t.info.model ? '' : 'muted'}`}>
                  {t.sub}
                </span>
                {t.info.model && <span className="cascade-check">✓</span>}
                <span className="cascade-arrow">›</span>
              </button>
            ))
          )}
          <div className="cascade-divider" />
          <button className="cascade-action" onClick={() => setShowRegisterForm(true)}>
            ＋ 登记新项目…
          </button>
          <button className="cascade-action" onClick={() => setShowOverview(true)}>
            ⚙ 配置总览
          </button>
        </div>

        <div className="cascade-right">
          <div className="cascade-right-header">
            应用至：{targets.find((t) => t.key === activeTarget)?.label ?? '—'}
            {activeInfo?.full_path && (
              <span className="overview-badge shared">当前 {activeInfo.source_file}</span>
            )}
          </div>
          {configs.length === 0 ? (
            <div className="cascade-empty">暂无模型配置档</div>
          ) : (
            configs.map((c) => {
              const isActiveModel = activeInfo?.model === c.model
              const isSelected = selectedProfileId === c.id
              return (
                <button
                  key={c.id}
                  className={`cascade-profile ${isSelected ? 'selected' : ''}`}
                  disabled={applyingId !== null}
                  onClick={() => setSelectedProfileId(isSelected ? null : c.id)}
                >
                  <span className="cascade-profile-name">{c.name}</span>
                  <span className="cascade-profile-model">{c.model}</span>
                  {c.tiers?.haiku && (
                    <span className="cascade-tier-dot" title={`haiku 档：${c.tiers.haiku}`}>
                      分级
                    </span>
                  )}
                  {applyingId === c.id ? (
                    <span className="cascade-check applying">…</span>
                  ) : (
                    isActiveModel && <span className="cascade-check">✓</span>
                  )}
                </button>
              )
            })
          )}
          {menuError && <div className="cascade-error">{menuError}</div>}
          <div className="cascade-confirm-row">
            <button
              className="btn btn-primary cascade-confirm"
              disabled={!selectedProfileId || applyingId !== null}
              onClick={() => selectedProfileId && handleApply(selectedProfileId)}
            >
              {applyingId !== null
                ? '应用中…'
                : `确认应用至「${targets.find((t) => t.key === activeTarget)?.label ?? '—'}」`}
            </button>
          </div>
          {appliedProjectPath && (
            <div className="cascade-next-row">
              <span className="cascade-next-label">下一步</span>
              <button className="btn btn-secondary" onClick={handleGitInit}>
                初始化 git
              </button>
              <button className="btn btn-secondary" onClick={handleOpenTerminal}>
                打开终端启动 Claude Code
              </button>
            </div>
          )}
        </div>
      </div>

      {toast && <div className="cascade-toast">{toast}</div>}

      {showRegisterForm && (
        <div
          className="dialog-overlay"
          onClick={(e) => {
            e.stopPropagation()
            setShowRegisterForm(false)
          }}
        >
          <div className="dialog-content export-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <h2 className="dialog-title">登记项目</h2>
              <button className="dialog-close" onClick={() => setShowRegisterForm(false)}>
                x
              </button>
            </div>
            <div className="dialog-body">
              <div className="field-group">
                <label className="field-label">方式一：选择已有目录</label>
                <button className="btn btn-secondary" onClick={handlePickExistingDir}>
                  选择目录并登记…
                </button>
              </div>
              <div className="field-group cascade-subform">
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
              {menuError && (
                <div className="error-state">
                  <p className="error-message">{menuError}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showOverview && <ConfigOverviewDialog onClose={() => setShowOverview(false)} />}
    </div>
  )
}

export default QuickApplyMenu
