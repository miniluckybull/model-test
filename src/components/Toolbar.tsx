import { useState } from 'react'
import { useConfigStore } from '../store/configStore'
import { CONFIG_TEMPLATES } from '../utils/templates'

export function Toolbar() {
  const [showTemplates, setShowTemplates] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState('')
  const [importError, setImportError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)

  const { addConfig, exportConfigs, importConfigs } = useConfigStore()

  const handleExportAll = () => {
    exportConfigs()
  }

  const handleImport = async () => {
    if (!importText.trim()) {
      setImportError('Please paste JSON data')
      return
    }

    setImporting(true)
    setImportError(null)

    try {
      await importConfigs(importText)
      setImportText('')
      setShowImport(false)
      alert('Import successful!')
    } catch (error) {
      setImportError(error instanceof Error ? error.message : String(error))
    } finally {
      setImporting(false)
    }
  }

  const handleUseTemplate = async (template: typeof CONFIG_TEMPLATES[0]) => {
    const apiKey = prompt(`Enter API Key for ${template.name}:`)
    if (!apiKey) return

    try {
      await addConfig({
        name: template.name,
        provider: template.provider,
        endpoint: template.endpoint,
        model: template.model,
        apiKey: apiKey,
        tags: ['template'],
      })
      setShowTemplates(false)
      alert('Template added successfully!')
    } catch (error) {
      alert(`Failed to add template: ${error}`)
    }
  }

  return (
    <div className="toolbar">
      <button onClick={() => setShowTemplates(!showTemplates)} className="toolbar-btn">
        📋 Templates
      </button>
      <button onClick={handleExportAll} className="toolbar-btn">
        📤 Export All
      </button>
      <button onClick={() => setShowImport(!showImport)} className="toolbar-btn">
        📥 Import
      </button>

      {showTemplates && (
        <div className="dropdown-panel">
          <div className="panel-header">
            <h3>Configuration Templates</h3>
            <button onClick={() => setShowTemplates(false)} className="close-btn">✕</button>
          </div>
          <div className="template-list">
            {CONFIG_TEMPLATES.map((template, index) => (
              <div key={index} className="template-item">
                <div className="template-info">
                  <strong>{template.name}</strong>
                  <span className="template-desc">{template.description}</span>
                  <code className="template-endpoint">{template.endpoint}</code>
                </div>
                <button onClick={() => handleUseTemplate(template)} className="use-template-btn">
                  Use
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {showImport && (
        <div className="dropdown-panel">
          <div className="panel-header">
            <h3>Import Configurations</h3>
            <button onClick={() => setShowImport(false)} className="close-btn">✕</button>
          </div>
          <div className="import-form">
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="Paste JSON configuration data here..."
              rows={10}
              className="import-textarea"
            />
            {importError && <div className="import-error">{importError}</div>}
            <div className="import-actions">
              <button onClick={() => setShowImport(false)} className="cancel-btn">
                Cancel
              </button>
              <button onClick={handleImport} disabled={importing} className="import-btn">
                {importing ? 'Importing...' : 'Import'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
