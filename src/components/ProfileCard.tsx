import { useEffect, useState } from 'react'
import { listen } from '@tauri-apps/api/event'
import { ApiConfig, TestResult } from '../types'
import { useConfigStore } from '../store/configStore'
import { testModel } from '../services/tauriCommands'
import { PROVIDERS } from '../utils/constants'
import { CONNECTION_STATUS_META } from '../utils/connectionStatus'
import { Icon } from './Icon'

interface ProfileCardProps {
  config: ApiConfig
  compactMode?: boolean
}

function ProfileCard({ config, compactMode = false }: ProfileCardProps) {
  const updateConfig = useConfigStore((state) => state.updateConfig)
  const deleteConfig = useConfigStore((state) => state.deleteConfig)
  const duplicateConfig = useConfigStore((state) => state.duplicateConfig)
  const setConfigStatus = useConfigStore((state) => state.setConfigStatus)
  const updateTestResult = useConfigStore((state) => state.updateTestResult)

  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(config.name)
  const [editProvider, setEditProvider] = useState(config.provider)
  const [editEndpoint, setEditEndpoint] = useState(config.endpoint)
  const [editModel, setEditModel] = useState(config.model)
  const [editApiKey, setEditApiKey] = useState(config.apiKey)
  const [lastResult, setLastResult] = useState<TestResult | null>(null)
  const [resultExpanded, setResultExpanded] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    let unlisten: (() => void) | undefined

    const setupListener = async () => {
      unlisten = await listen('test-complete', (event: any) => {
        const payload = event.payload
        if (payload.config_id !== config.id) return
        setLastResult({
          configId: payload.config_id,
          success: payload.success,
          latencyMs: payload.latency_ms,
          promptTokens: payload.prompt_tokens,
          completionTokens: payload.completion_tokens,
          totalTokens: payload.total_tokens,
          errorMessage: payload.error_message,
          modelResponse: payload.model_response,
          actualModel: payload.actual_model,
        })
      })
    }

    setupListener().catch((error) => console.error('Failed to listen for test result:', error))
    return () => unlisten?.()
  }, [config.id])

  const handleTest = async () => {
    setConfigStatus(config.id, 'running')
    setLastResult(null)
    setResultExpanded(false)

    if (isEditing) {
      await updateConfig(config.id, {
        name: editName,
        provider: editProvider,
        endpoint: editEndpoint,
        model: editModel,
        apiKey: editApiKey,
      })
      setIsEditing(false)
    }

    try {
      await testModel(config.id)
    } catch (error: any) {
      const result: TestResult = {
        configId: config.id,
        success: false,
        latencyMs: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        errorMessage: error.toString(),
        actualModel: undefined,
      }
      setLastResult(result)
      updateTestResult(config.id, result)
      setConfigStatus(config.id, 'failed')
    }
  }

  const handleSave = async () => {
    await updateConfig(config.id, {
      name: editName,
      provider: editProvider,
      endpoint: editEndpoint,
      model: editModel,
      apiKey: editApiKey,
    })
    setIsEditing(false)
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    setDeleteError(null)

    try {
      await deleteConfig(config.id)
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : String(error))
      setIsDeleting(false)
    }
  }

  const providerName = PROVIDERS[config.provider]?.name || '自定义'
  const statusMeta = CONNECTION_STATUS_META[config.status]
  const lastTestedTime = config.lastTestedAt
    ? new Date(config.lastTestedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '从未'
  const hasLastLatency = typeof config.lastLatency === 'number'
  const hasLastTokens = typeof config.lastTokens === 'number'
  const hasTestStats = hasLastLatency || hasLastTokens || Boolean(config.lastTestedAt)

  return (
    <article className={`profile-card status-${config.status} ${compactMode && !isEditing ? 'is-compact' : ''}`}>
      {!isEditing ? (
        <>
          <div className="card-heading-row">
            <div className="card-title-block">
              <h3 className="card-model-id" title={config.model}>{config.model}</h3>
              <p className="card-config-name" title={config.name}>{config.name}</p>
            </div>
            {!compactMode && (
              <span className={`connection-status ${config.status}`}>
                <Icon name={statusMeta.icon} size={13} strokeWidth={2.2} />
                <span>{statusMeta.label}</span>
              </span>
            )}
          </div>

          {!compactMode && (hasTestStats ? (
            <div className="test-summary-strip">
              <div className="test-primary-metric">
                <span className="stat-label">响应延迟</span>
                <span className={`stat-value ${config.status === 'ok' ? 'green' : config.status === 'failed' ? 'red' : 'amber'}`}>
                  {hasLastLatency ? config.lastLatency : '—'}<small>{hasLastLatency ? ' ms' : ''}</small>
                </span>
              </div>
              <div className="test-secondary-metric">
                <span className="stat-label">Tokens</span>
                <span className="stat-value">{hasLastTokens ? config.lastTokens : '—'}</span>
              </div>
              <div className="test-secondary-metric tested-at">
                <span className="stat-label">最近检测</span>
                <span className="stat-value">{lastTestedTime}</span>
              </div>
            </div>
          ) : (
            <div className="card-no-test">
              <Icon name="activity" size={15} />
              <span>尚未运行连接测试</span>
              <span>READY</span>
            </div>
          ))}

          {!compactMode && lastResult && (
            <div className={`result-panel-compact ${resultExpanded ? 'expanded' : ''}`}>
              <button
                className="result-toggle"
                onClick={() => setResultExpanded(!resultExpanded)}
                aria-label="切换结果详情"
                aria-expanded={resultExpanded}
              >
                <span className="result-summary">
                  {lastResult.success ? (
                    <>
                      <span className="result-status success"><Icon name="check" size={11} /></span>
                      <span className="result-stats-inline">
                        {lastResult.actualModel ? `返回模型：${lastResult.actualModel}` : '查看响应详情'}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="result-status error"><Icon name="x" size={11} /></span>
                      <span className="result-error-brief">{lastResult.errorMessage?.substring(0, 50) || '连接测试失败'}</span>
                    </>
                  )}
                </span>
                <Icon name="chevron-down" size={13} className={`chevron ${resultExpanded ? 'rotated' : ''}`} />
              </button>

              {resultExpanded && (
                <div className="result-details">
                  {lastResult.success ? (
                    <div>
                      {lastResult.actualModel && (
                        <div className="result-actual-model">实际模型：{lastResult.actualModel}</div>
                      )}
                      <pre className="result-response">{lastResult.modelResponse}</pre>
                    </div>
                  ) : (
                    <div className="result-error-full">{lastResult.errorMessage}</div>
                  )}
                </div>
              )}
            </div>
          )}

          {showDeleteConfirm && (
            <div className="delete-confirm">
              <strong>删除「{config.name}」？</strong>
              <span>此操作只会删除本地配置档案。</span>
              {deleteError && <span className="delete-error">{deleteError}</span>}
              <div className="delete-confirm-actions">
                <button className="btn btn-danger" onClick={handleDelete} disabled={isDeleting}>
                  {isDeleting ? '删除中…' : '确认删除'}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowDeleteConfirm(false)
                    setDeleteError(null)
                  }}
                  disabled={isDeleting}
                >
                  取消
                </button>
              </div>
            </div>
          )}

          <div className="card-footer">
            <button
              className="card-test-button"
              onClick={handleTest}
              disabled={config.status === 'running'}
            >
              <Icon name="activity" size={16} className={config.status === 'running' ? 'is-spinning' : ''} />
              <span>{config.status === 'running' ? '正在检测' : '运行测试'}</span>
            </button>
            <div className="card-utility-actions">
              <button
                className="btn-icon btn-edit"
                onClick={() => {
                  setEditName(config.name)
                  setEditProvider(config.provider)
                  setEditEndpoint(config.endpoint)
                  setEditModel(config.model)
                  setEditApiKey(config.apiKey)
                  setIsEditing(true)
                }}
                title="编辑配置"
                aria-label={`编辑 ${config.name}`}
              >
                <Icon name="edit" size={15} />
              </button>
              <button
                className="btn-icon btn-duplicate"
                onClick={() => duplicateConfig(config.id)}
                title="创建副本"
                aria-label={`复制 ${config.name}`}
              >
                <Icon name="copy" size={15} />
              </button>
              <button
                className="btn-icon btn-delete"
                onClick={() => setShowDeleteConfirm(true)}
                title="删除配置"
                aria-label={`删除 ${config.name}`}
                disabled={isDeleting}
              >
                <Icon name="trash" size={15} />
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="card-header">
            <div>
              <span className="section-kicker">EDIT PROFILE</span>
              <h3 className="card-name">编辑配置</h3>
            </div>
            <span className="provider-glyph">{providerName.charAt(0)}</span>
          </div>

          <div className="card-form">
            <div className="field-group">
              <label className="field-label" htmlFor={`name-${config.id}`}>配置名称</label>
              <input
                id={`name-${config.id}`}
                type="text"
                className="field-input"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>

            <div className="field-row">
              <div className="field-group">
                <label className="field-label" htmlFor={`provider-${config.id}`}>提供商</label>
                <select
                  id={`provider-${config.id}`}
                  className="field-input"
                  value={editProvider}
                  onChange={(e) => setEditProvider(e.target.value as any)}
                >
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="custom">自定义</option>
                </select>
              </div>
              <div className="field-group">
                <label className="field-label" htmlFor={`model-${config.id}`}>模型</label>
                <input
                  id={`model-${config.id}`}
                  type="text"
                  className="field-input"
                  value={editModel}
                  onChange={(e) => setEditModel(e.target.value)}
                />
              </div>
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor={`endpoint-${config.id}`}>端点</label>
              <input
                id={`endpoint-${config.id}`}
                type="text"
                className="field-input"
                value={editEndpoint}
                onChange={(e) => setEditEndpoint(e.target.value)}
              />
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor={`key-${config.id}`}>API Key</label>
              <input
                id={`key-${config.id}`}
                type="password"
                className="field-input"
                value={editApiKey}
                onChange={(e) => setEditApiKey(e.target.value)}
              />
            </div>
          </div>

          <div className="card-footer edit-footer">
            <button className="btn btn-primary" onClick={handleSave}>保存更改</button>
            <button className="btn btn-secondary" onClick={() => setIsEditing(false)}>取消</button>
          </div>
        </>
      )}
    </article>
  )
}

export default ProfileCard
