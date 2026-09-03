import { useState } from 'react'
import { useConfigStore } from '../store/configStore'
import { PROVIDERS } from '../utils/constants'
import { validateConfig, formatValidationErrors } from '../utils/validation'

interface AddProfileTileProps {
  onAdd?: () => void
}

function AddProfileTile({ onAdd }: AddProfileTileProps) {
  const [isAdding, setIsAdding] = useState(false)
  const addConfig = useConfigStore((state) => state.addConfig)

  const [name, setName] = useState('')
  const [provider, setProvider] = useState<'openai' | 'anthropic' | 'custom'>('openai')
  const [endpoint, setEndpoint] = useState('')
  const [model, setModel] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)

  const handleAdd = async () => {
    if (!name || !endpoint || !model || !apiKey) return

    // Validate config
    const errors = validateConfig(name, endpoint, model, apiKey)
    if (errors.length > 0) {
      setValidationError(formatValidationErrors(errors))
      return
    }

    try {
      await addConfig({
        name,
        provider,
        endpoint,
        model,
        apiKey,
        tags: [],
      })

      setName('')
      setProvider('openai')
      setEndpoint('')
      setModel('')
      setApiKey('')
      setIsAdding(false)
      setValidationError(null)
      onAdd?.()
    } catch (error) {
      setValidationError(`Failed to add config: ${error}`)
    }
  }

  const handleProviderChange = (newProvider: 'openai' | 'anthropic' | 'custom') => {
    setProvider(newProvider)
    const preset = PROVIDERS[newProvider]
    if (preset.defaultEndpoint && !endpoint) {
      setEndpoint(preset.defaultEndpoint)
    }
    if (preset.defaultModel && !model) {
      setModel(preset.defaultModel)
    }
  }

  if (!isAdding) {
    return (
      <button className="add-profile-tile" onClick={() => setIsAdding(true)}>
        <span className="add-icon">+</span>
        <span className="add-text">Add New Profile</span>
      </button>
    )
  }

  return (
    <div className="profile-card">
      <div className="card-header">
        <div>
          <h3 className="card-name">New API Profile</h3>
          <p className="card-description">Configure your model endpoint</p>
        </div>
      </div>

      <div className="card-form">
        <div className="field-group">
          <label className="field-label">Use</label>
          <input
            type="text"
            className="field-input"
            placeholder="e.g., My Claude Model"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="field-row">
          <div className="field-group">
            <label className="field-label">Provider</label>
            <select
              className="field-input"
              value={provider}
              onChange={(e) => handleProviderChange(e.target.value as any)}
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
              placeholder="e.g., gpt-4o-mini"
              value={model}
              onChange={(e) => setModel(e.target.value)}
            />
          </div>
        </div>

        <div className="field-group">
          <label className="field-label">Endpoint</label>
          <input
            type="text"
            className="field-input"
            placeholder="https://api.example.com"
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
          />
        </div>

        <div className="field-group">
          <label className="field-label">API Key</label>
          <input
            type="password"
            className="field-input"
            placeholder="sk-..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </div>

        {validationError && (
          <div className="error-message">
            {validationError}
          </div>
        )}
      </div>

      <div className="card-footer">
        <button className="btn btn-primary" onClick={handleAdd} disabled={!name || !endpoint || !model || !apiKey}>
          Add Profile
        </button>
        <button className="btn btn-secondary" onClick={() => setIsAdding(false)}>
          Cancel
        </button>
      </div>
    </div>
  )
}

export default AddProfileTile
