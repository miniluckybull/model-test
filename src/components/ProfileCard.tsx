import { useState, useEffect } from 'react'
import { ApiConfig, TestResult } from '../types'
import { useConfigStore } from '../store/configStore'
import { testModel } from '../services/tauriCommands'
import { PROVIDERS, STATUS_COLORS } from '../utils/constants'
import Tag from './Tag'
import ResultPanel from './ResultPanel'
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
            <div>
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
              <span className="meta-value">{config.endpoint}</span>
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
            <ResultPanel
              success={lastResult.success}
              latencyMs={lastResult.latencyMs}
              tokens={lastResult.totalTokens}
              response={lastResult.modelResponse}
              error={lastResult.errorMessage}
            />
          )}

          <div className="card-footer">
            <button
              className="btn btn-primary"
              onClick={handleTest}
              disabled={config.status === 'running'}
            >
              {config.status === 'running' ? 'Testing...' : 'Test'}
            </button>
            <button className="btn btn-secondary" onClick={() => {
              setEditName(config.name)
              setEditProvider(config.provider)
              setEditEndpoint(config.endpoint)
              setEditModel(config.model)
              setEditApiKey(config.apiKey)
              setIsEditing(true)
            }}>
              Edit
            </button>
            <button className="btn btn-secondary" onClick={() => duplicateConfig(config.id)} title="Duplicate">
              Duplicate
            </button>
            <button className="btn btn-secondary btn-delete" onClick={handleDelete} title="Delete">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
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
