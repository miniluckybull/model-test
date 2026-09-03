import { useState, useEffect, useCallback } from 'react'
import { ApiConfig, ConfigComparison, ExportToProjectResult } from '../types'
import { previewClaudeConfig, applyClaudeConfig, applyCustomClaudeConfig, exportToProject } from '../services/tauriCommands'
import { open } from '@tauri-apps/plugin-dialog'

interface ClaudeConfigDialogProps {
  isOpen: boolean
  onClose: () => void
  config: ApiConfig
}

function ClaudeConfigDialog({ isOpen, onClose, config }: ClaudeConfigDialogProps) {
  const [comparison, setComparison] = useState<ConfigComparison | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [customConfigPath, setCustomConfigPath] = useState('')
  const [useCustomPath, setUseCustomPath] = useState(false)
  const [editableConfig, setEditableConfig] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [thinkingMode, setThinkingMode] = useState<'auto' | 'enabled' | 'disabled'>('auto')
  const [thinkingEffort, setThinkingEffort] = useState<'low' | 'medium' | 'high' | 'xhigh' | 'max'>('high')
  const [maxTokens, setMaxTokens] = useState<number>(8192)
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [projectPath, setProjectPath] = useState('')
  const [exportResult, setExportResult] = useState<ExportToProjectResult | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)

  const activeConfigPath = useCustomPath && customConfigPath ? customConfigPath : undefined

  const loadComparison = useCallback(async () => {
    if (!config) return

    setLoading(true)
    setError(null)

    try {
      const request = {
        api_key: config.apiKey,
        auth_token: config.apiKey,
        base_url: config.endpoint,
        model: config.model,
        custom_config_path: activeConfigPath,
        thinking_mode: thinkingMode,
        thinking_effort: thinkingEffort,
        max_tokens: maxTokens > 0 ? maxTokens : undefined,
      }

      const result = await previewClaudeConfig(request)
      setComparison(result)
      setEditableConfig(result.new_config_json)
      setIsEditing(false)

      if (!useCustomPath && result.config_path) {
        setCustomConfigPath(result.config_path)
      }
    } catch (err: any) {
      setError(err.toString())
    } finally {
      setLoading(false)
    }
  }, [config, activeConfigPath, useCustomPath, thinkingMode, thinkingEffort, maxTokens])

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
        const request = {
          api_key: config.apiKey,
          auth_token: config.apiKey,
          base_url: config.endpoint,
          model: config.model,
          custom_config_path: activeConfigPath,
          thinking_mode: thinkingMode,
          thinking_effort: thinkingEffort,
          max_tokens: maxTokens > 0 ? maxTokens : undefined,
        }
        await applyClaudeConfig(request)
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

  const handleConfigPathChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomConfigPath(e.target.value)
  }

  const handleToggleCustomPath = () => {
    setUseCustomPath(!useCustomPath)
    if (!useCustomPath && comparison && comparison.config_path) {
      setCustomConfigPath(comparison.config_path)
    }
  }

  const handleSelectDetectedPath = (path: string) => {
    setCustomConfigPath(path.replace(' (exists)', ''))
    setUseCustomPath(true)
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
        title: 'Select Project Directory',
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
      const request = {
        api_key: config.apiKey,
        auth_token: config.apiKey,
        base_url: config.endpoint,
        model: config.model,
        thinking_mode: thinkingMode,
        thinking_effort: thinkingEffort,
        max_tokens: maxTokens > 0 ? maxTokens : undefined,
      }

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

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-content" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h2 className="dialog-title">Apply to Claude Code</h2>
          <button className="dialog-close" onClick={onClose}>x</button>
        </div>

        <div className="dialog-body">
          <div className="config-path-section">
            <label className="config-path-label">
              <input 
                type="checkbox" 
                checked={useCustomPath} 
                onChange={handleToggleCustomPath}
              />
              Custom Config Path
            </label>
            {useCustomPath && (
              <input
                type="text"
                className="field-input config-path-input"
                value={customConfigPath}
                onChange={handleConfigPathChange}
                placeholder="~/.claude/settings.json"
              />
            )}
            
            {comparison && comparison.detected_paths.length > 0 && (
              <div className="detected-paths">
                <div className="detected-paths-header">
                  <span className="detected-paths-label">Detected paths:</span>
                  <span className="detected-paths-hint">Click to select a path · Green = exists</span>
                </div>
                <div className="detected-paths-list">
                  {comparison.detected_paths.map((path, idx) => {
                    const isExists = path.includes('(exists)')
                    const cleanPath = path.replace(' (exists)', '')
                    const isRecommended = idx === 0 && cleanPath.includes('.claude/settings.json')
                    
                    return (
                      <button
                        key={idx}
                        className={`detected-path-btn ${isExists ? 'exists' : ''} ${isRecommended ? 'recommended' : ''}`}
                        onClick={() => handleSelectDetectedPath(path)}
                        title={isRecommended ? 'Recommended: Claude Code official config' : ''}
                      >
                        <span className="path-indicator">
                          {isExists ? '✓' : '○'}
                        </span>
                        <span className="path-text">{cleanPath}</span>
                        {isRecommended && <span className="path-badge">Recommended</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {!loading && !success && (
            <div className="advanced-section">
              <button
                className="advanced-toggle"
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                <span>{showAdvanced ? '▼' : '▶'}</span>
                Advanced Settings
              </button>

              {showAdvanced && (
                <div className="advanced-fields">
                  <div className="field-group">
                    <label className="field-label">Thinking Mode</label>
                    <select
                      className="field-select"
                      value={thinkingMode}
                      onChange={(e) => setThinkingMode(e.target.value as any)}
                    >
                      <option value="auto">Auto (Recommended)</option>
                      <option value="enabled">Enabled</option>
                      <option value="disabled">Disabled</option>
                    </select>
                    <span className="field-hint">Controls when the model shows reasoning</span>
                  </div>

                  <div className="field-group">
                    <label className="field-label">Thinking Effort</label>
                    <select
                      className="field-select"
                      value={thinkingEffort}
                      onChange={(e) => setThinkingEffort(e.target.value as any)}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High (Default)</option>
                      <option value="xhigh">Extra High</option>
                      <option value="max">Maximum</option>
                    </select>
                    <span className="field-hint">Depth of reasoning for complex tasks</span>
                  </div>

                  <div className="field-group">
                    <label className="field-label">Max Tokens</label>
                    <input
                      type="number"
                      className="field-input"
                      value={maxTokens}
                      onChange={(e) => setMaxTokens(parseInt(e.target.value) || 0)}
                      min="1024"
                      max="200000"
                      step="1024"
                    />
                    <span className="field-hint">Maximum response length (1024-200000)</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {loading && !comparison && (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading configuration...</p>
            </div>
          )}

          {error && (
            <div className="error-state">
              <p className="error-message">{error}</p>
              <button className="btn btn-secondary" onClick={loadComparison}>
                Retry
              </button>
            </div>
          )}

          {success && (
            <div className="success-state">
              <div className="success-icon">OK</div>
              <p>Configuration applied successfully!</p>
              <p className="success-detail">Claude Code will use the new configuration on next launch.</p>
            </div>
          )}

          {comparison && !loading && !success && (
            <>
              <div className="config-section">
                <h3 className="section-title">Current Claude Code Config</h3>
                <div className="config-block">
                  <pre className="config-json">{comparison.current_config_json || '{}'}</pre>
                </div>
              </div>

              <div className="config-arrow">Will be changed to</div>

              <div className="config-section">
                <div className="section-title-row">
                  <h3 className="section-title">New Config (Editable)</h3>
                  <button 
                    className="btn-icon btn-edit-config"
                    onClick={handleToggleEdit}
                    title={isEditing ? 'Preview' : 'Edit'}
                  >
                    {isEditing ? 'OK' : 'Edit'}
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
                  <strong>Config file:</strong> {comparison.config_path}
                </p>
                <p className="info-text">
                  <strong>Source:</strong> {config.name} ({config.model})
                </p>
                {config.lastLatency !== undefined && (
                  <p className="info-text">
                    <strong>Latency:</strong> {config.lastLatency}ms
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        <div className="dialog-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => setShowExportDialog(true)}
            disabled={loading || success}
          >
            Export to Project
          </button>
          <button
            className="btn btn-primary"
            onClick={handleApply}
            disabled={loading || success}
          >
            {loading ? 'Applying...' : success ? 'Applied!' : 'Apply Changes'}
          </button>
        </div>
      </div>

      {showExportDialog && (
        <div className="dialog-overlay" onClick={() => setShowExportDialog(false)}>
          <div className="dialog-content export-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <h2 className="dialog-title">Export to Project</h2>
              <button className="dialog-close" onClick={() => setShowExportDialog(false)}>x</button>
            </div>

            <div className="dialog-body">
              {!exportResult ? (
                <>
                  <div className="field-group">
                    <label className="field-label">Project Directory</label>
                    <div className="path-input-row">
                      <input
                        type="text"
                        className="field-input"
                        value={projectPath}
                        onChange={(e) => setProjectPath(e.target.value)}
                        placeholder="Select a project directory..."
                        readOnly
                      />
                      <button className="btn btn-secondary" onClick={handleBrowseProject}>
                        Browse
                      </button>
                    </div>
                    <span className="field-hint">
                      Configuration will be saved to: {projectPath ? `${projectPath}/.claude/settings.json` : '(select a directory)'}
                    </span>
                  </div>

                  {exportError && (
                    <div className="error-state">
                      <p className="error-message">{exportError}</p>
                    </div>
                  )}

                  <div className="export-info">
                    <h3 className="section-title">What will be exported:</h3>
                    <ul className="export-items">
                      <li><strong>Model:</strong> {config.model}</li>
                      <li><strong>Endpoint:</strong> {config.endpoint}</li>
                      <li><strong>Thinking Mode:</strong> {thinkingMode}</li>
                      <li><strong>Thinking Effort:</strong> {thinkingEffort}</li>
                      <li><strong>Max Tokens:</strong> {maxTokens}</li>
                    </ul>
                  </div>
                </>
              ) : (
                <div className="success-state">
                  <div className="success-icon">✓</div>
                  <p>Configuration exported successfully!</p>
                  <p className="success-detail">
                    {exportResult.created_directory && 'Created .claude directory and '}
                    Saved to: <code>{exportResult.config_path}</code>
                  </p>
                  <p className="success-hint">
                    Launch Claude Code in this project directory to use this configuration.
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
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleExportToProject}
                disabled={loading || !projectPath || !!exportResult}
              >
                {loading ? 'Exporting...' : 'Export'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ClaudeConfigDialog
