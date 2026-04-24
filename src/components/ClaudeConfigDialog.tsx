import { useState, useEffect, useCallback } from 'react'
import { ApiConfig, ConfigComparison } from '../types'
import { previewClaudeConfig, applyClaudeConfig, applyCustomClaudeConfig } from '../services/tauriCommands'

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
  }, [config, activeConfigPath, useCustomPath])

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
            className="btn btn-primary" 
            onClick={handleApply} 
            disabled={loading || success}
          >
            {loading ? 'Applying...' : success ? 'Applied!' : 'Apply Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ClaudeConfigDialog
