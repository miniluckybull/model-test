import { useState, useEffect } from 'react'
import { ApiConfig, ConfigComparison } from '../types'
import { previewClaudeConfig, applyClaudeConfig } from '../services/tauriCommands'

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

  useEffect(() => {
    if (isOpen && config) {
      loadComparison()
    }
  }, [isOpen, config])

  const loadComparison = async () => {
    if (!config) return
    
    setLoading(true)
    setError(null)
    
    try {
      const request = {
        api_key: config.apiKey,
        base_url: config.endpoint,
        model: config.model,
      }
      
      const result = await previewClaudeConfig(request)
      setComparison(result)
    } catch (err: any) {
      setError(err.toString())
    } finally {
      setLoading(false)
    }
  }

  const handleApply = async () => {
    if (!config) return
    
    setLoading(true)
    setError(null)
    
    try {
      const request = {
        api_key: config.apiKey,
        base_url: config.endpoint,
        model: config.model,
      }
      
      await applyClaudeConfig(request)
      setSuccess(true)
      
      // Show success for 2 seconds then close
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

  const maskApiKey = (key: string): string => {
    if (!key || key.length < 10) return '***'
    return key.substring(0, 6) + '***' + key.substring(key.length - 4)
  }

  if (!isOpen || !config) return null

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-content" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h2 className="dialog-title">Apply to Claude Code</h2>
          <button className="dialog-close" onClick={onClose}>×</button>
        </div>

        <div className="dialog-body">
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
              <div className="success-icon">✓</div>
              <p>Configuration applied successfully!</p>
              <p className="success-detail">Claude Code will use the new configuration on next launch.</p>
            </div>
          )}

          {comparison && !loading && !success && (
            <>
              <div className="config-section">
                <h3 className="section-title">Current Claude Code Config</h3>
                <div className="config-block">
                  <pre className="config-json">
                    {JSON.stringify({
                      env: Object.fromEntries(
                        Object.entries(comparison.current_config.env || {}).map(([key, value]) => [
                          key,
                          key.includes('KEY') || key.includes('TOKEN') ? maskApiKey(value) : value
                        ])
                      ),
                      model: comparison.current_config.model || '(not set)'
                    }, null, 2)}
                  </pre>
                </div>
              </div>

              <div className="config-arrow">↓ Will be changed to ↓</div>

              <div className="config-section">
                <h3 className="section-title">New Config from Model Tester</h3>
                <div className="config-block highlight">
                  <pre className="config-json">
                    {JSON.stringify({
                      ANTHROPIC_API_KEY: maskApiKey(config.apiKey),
                      ...(config.endpoint ? { ANTHROPIC_BASE_URL: config.endpoint } : {}),
                      ...(config.model ? { ANTHROPIC_MODEL: config.model } : {}),
                    }, null, 2)}
                  </pre>
                </div>
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
