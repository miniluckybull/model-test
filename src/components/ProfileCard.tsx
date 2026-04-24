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
    if (confirm(`Delete "${config.name}"?`)) {
      await deleteConfig(config.id)
    }
  }

  const statusColor = STATUS_COLORS[config.status]

  return (
    <div className={`profile-card status-${config.status}`}>
      {!isEditing ? (
        <>
          <div className="card-header">
            <div className="card-header-left">
              <h3 className="card-name">{config.name}</h3>
              <p className="card-description">{PROVIDERS[config.provider]?.name || 'Custom'} • {config.model}</p>
            </div>
            <div className="card-actions">
              <Tag color={statusColor}>{config.status}</Tag>
            </div>
          </div>

          <div className="card-meta">
            <div className="meta-row">
              <span className="meta-label">Endpoint</span>
              <span className="meta-value truncate">{config.endpoint}</span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Model</span>
              <span className="meta-value">{config.model}</span>
            </div>
          </div>

          {(config.lastLatency !== undefined || config.lastTokens !== undefined) && (
            <div className="card-stats">
              <div className="stat-item">
                <span className="stat-label">Latency</span>
                <span className={`stat-value ${config.status === 'ok' ? 'green' : config.status === 'failed' ? 'red' : 'amber'}`}>
                  {config.lastLatency}ms
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Tokens</span>
                <span className="stat-value">{config.lastTokens}</span>
              </div>
              {config.lastTestedAt && (
                <div className="stat-item">
                  <span className="stat-label">Last Tested</span>
                  <span className="stat-value">{new Date(config.lastTestedAt).toLocaleTimeString()}</span>
                </div>
              )}
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
                        {lastResult.latencyMs}ms • {lastResult.totalTokens} tokens
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
                    <pre className="result-response">{lastResult.modelResponse}</pre>
                  ) : (
                    <div className="result-error-full">{lastResult.errorMessage}</div>
                  )}
                </div>
              )}
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
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                </svg>
              </button>
            )}
            
            <button 
              className="btn-icon btn-delete" 
              onClick={handleDelete} 
              title="Delete"
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
              <label className="field-label">Name</label>
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
