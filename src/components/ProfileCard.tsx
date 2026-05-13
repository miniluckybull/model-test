import { useState, useEffect } from 'react'
import { ApiConfig, TestResult } from '../types'
import { useConfigStore } from '../store/configStore'
import { testModel } from '../services/tauriCommands'
import { PROVIDERS, STATUS_COLORS } from '../utils/constants'
import Tag from './Tag'
import ClaudeConfigDialog from './ClaudeConfigDialog'
import { listen } from '@tauri-apps/api/event'

interface ProfileCardProps {
  config: ApiConfig
}

function ProfileCard({ config }: ProfileCardProps) {
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
  const [showClaudeDialog, setShowClaudeDialog] = useState(false)
  const [resultExpanded, setResultExpanded] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    let unlisten: (() => void) | undefined

    const setupListener = async () => {
      unlisten = await listen('test-complete', (event: any) => {
        const payload = event.payload
        if (payload.config_id === config.id) {
          const result: TestResult = {
            configId: payload.config_id,
            success: payload.success,
            latencyMs: payload.latency_ms,
            promptTokens: payload.prompt_tokens,
            completionTokens: payload.completion_tokens,
            totalTokens: payload.total_tokens,
            errorMessage: payload.error_message,
            modelResponse: payload.model_response,
            actualModel: payload.actual_model,
          }
          setLastResult(result)
          updateTestResult(config.id, result)
          setConfigStatus(config.id, result.success ? 'ok' : 'failed')
        }
      })
    }

    setupListener()

    return () => {
      if (unlisten) unlisten()
    }
  }, [config.id, updateTestResult, setConfigStatus])

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

  const statusColor = STATUS_COLORS[config.status]
  const providerName = PROVIDERS[config.provider]?.name || 'Custom'
  const lastTestedTime = config.lastTestedAt
    ? new Date(config.lastTestedAt).toLocaleTimeString()
    : 'Never'
  const hasTestStats = config.lastLatency !== undefined || config.lastTokens !== undefined || config.lastTestedAt

  return (
    <div className={`profile-card status-${config.status}`}>
      {!isEditing ? (
        <>
          <div className="config-overview" title={config.endpoint}>
            <div className="use-preview">
              <div className="preview-header">
                <span className="meta-label">Use</span>
                <Tag color={statusColor}>{config.status}</Tag>
              </div>
              <span className="use-value" title={config.name}>{config.name}</span>
            </div>
            <div className="model-preview">
              <div className="preview-header">
                <span className="meta-label">Model</span>
                <span className="provider-chip">{providerName}</span>
              </div>
              <span className="model-value" title={config.model}>{config.model}</span>
            </div>
          </div>

          {hasTestStats && (
            <div className="test-summary-strip">
              <div className="test-primary-metric">
                <span className="stat-label">Last Test</span>
                <span className={`stat-value ${config.status === 'ok' ? 'green' : config.status === 'failed' ? 'red' : 'amber'}`}>
                  {config.lastLatency !== undefined ? `${config.lastLatency}ms` : 'No latency'}
                </span>
              </div>
              <div className="test-secondary-metric">
                <span className="stat-label">Tokens</span>
                <span className="stat-value">{config.lastTokens ?? '—'}</span>
              </div>
              <div className="test-secondary-metric">
                <span className="stat-label">Time</span>
                <span className="stat-value">{lastTestedTime}</span>
              </div>
            </div>
          )}

          {lastResult && (
            <div className={`result-panel-compact ${resultExpanded ? 'expanded' : ''}`}>
              <button 
                className="result-toggle" 
                onClick={() => setResultExpanded(!resultExpanded)}
                aria-label="Toggle result details"
              >
                <span className="result-summary">
                  {lastResult.success ? (
                    <>
                      <span className="result-status success">✓</span>
                      <span className="result-stats-inline">
                        {lastResult.actualModel ? `Returned: ${lastResult.actualModel}` : 'Response details'}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="result-status error">✕</span>
                      <span className="result-error-brief">{lastResult.errorMessage?.substring(0, 50)}...</span>
                    </>
                  )}
                </span>
                <svg 
                  className={`chevron ${resultExpanded ? 'rotated' : ''}`} 
                  width="12" 
                  height="12" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2"
                >
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>
              
              {resultExpanded && (
                <div className="result-details">
                  {lastResult.success ? (
                    <div>
                      {lastResult.actualModel && (
                        <div className="result-error-full">Actual model: {lastResult.actualModel}</div>
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
              <span>Delete "{config.name}"?</span>
              {deleteError && <span className="delete-error">{deleteError}</span>}
              <div className="delete-confirm-actions">
                <button
                  className="btn btn-danger"
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowDeleteConfirm(false)
                    setDeleteError(null)
                  }}
                  disabled={isDeleting}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="card-footer">
            <button
              className="btn-icon btn-test"
              onClick={handleTest}
              disabled={config.status === 'running'}
              title={config.status === 'running' ? 'Testing...' : 'Test'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
            </button>
            
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
              title="Edit"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
            
            <button 
              className="btn-icon btn-duplicate" 
              onClick={() => duplicateConfig(config.id)} 
              title="Duplicate"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
            
            {config.status === 'ok' && (
              <button 
                className="btn-icon btn-claude" 
                onClick={() => setShowClaudeDialog(true)}
                title="Apply to Claude Code"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L2 12l10 10 10-10L12 2z"/>
                </svg>
              </button>
            )}
            
            <button 
              className="btn-icon btn-delete" 
              onClick={() => setShowDeleteConfirm(true)} 
              title="Delete"
              disabled={isDeleting}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>

          <ClaudeConfigDialog
            isOpen={showClaudeDialog}
            onClose={() => setShowClaudeDialog(false)}
            config={config}
          />
        </>
      ) : (
        <>
          <div className="card-header">
            <div>
              <h3 className="card-name">Edit Profile</h3>
            </div>
          </div>

          <div className="card-form">
            <div className="field-group">
              <label className="field-label">Use</label>
              <input
                type="text"
                className="field-input"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>

            <div className="field-row">
              <div className="field-group">
                <label className="field-label">Provider</label>
                <select
                  className="field-input"
                  value={editProvider}
                  onChange={(e) => setEditProvider(e.target.value as any)}
                >
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div className="field-group">
                <label className="field-label">Model</label>
                <input
                  type="text"
                  className="field-input"
                  value={editModel}
                  onChange={(e) => setEditModel(e.target.value)}
                />
              </div>
            </div>

            <div className="field-group">
              <label className="field-label">Endpoint</label>
              <input
                type="text"
                className="field-input"
                value={editEndpoint}
                onChange={(e) => setEditEndpoint(e.target.value)}
              />
            </div>

            <div className="field-group">
              <label className="field-label">API Key</label>
              <input
                type="password"
                className="field-input"
                value={editApiKey}
                onChange={(e) => setEditApiKey(e.target.value)}
              />
            </div>
          </div>

          <div className="card-footer">
            <button className="btn btn-success" onClick={handleSave}>
              Save
            </button>
            <button className="btn btn-secondary" onClick={() => setIsEditing(false)}>
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default ProfileCard
