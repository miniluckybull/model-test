import { useState } from 'react'
import { useConfigStore } from '../store/configStore'

interface ImportExportDialogProps {
  onClose: () => void
}

export default function ImportExportDialog({ onClose }: ImportExportDialogProps) {
  const exportConfigs = useConfigStore((state) => state.exportConfigs)
  const importConfigs = useConfigStore((state) => state.importConfigs)
  const configs = useConfigStore((state) => state.configs)

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [importText, setImportText] = useState('')
  const [isImporting, setIsImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [importSuccess, setImportSuccess] = useState(false)

  const handleSelectAll = () => {
    if (selectedIds.length === configs.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(configs.map(c => c.id))
    }
  }

  const handleToggleConfig = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id)
        ? prev.filter(i => i !== id)
        : [...prev, id]
    )
  }

  const handleExportAll = () => {
    exportConfigs()
  }

  const handleExportSelected = () => {
    if (selectedIds.length === 0) {
      alert('Please select at least one config to export')
      return
    }
    exportConfigs(selectedIds)
  }

  const handleImport = async () => {
    if (!importText.trim()) {
      setImportError('Please paste JSON data to import')
      return
    }

    setIsImporting(true)
    setImportError(null)
    setImportSuccess(false)

    try {
      await importConfigs(importText)
      setImportSuccess(true)
      setImportText('')
      setTimeout(() => {
        onClose()
      }, 1500)
    } catch (error) {
      setImportError(error instanceof Error ? error.message : String(error))
    } finally {
      setIsImporting(false)
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      setImportText(text)
    }
    reader.readAsText(file)
  }

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-content dialog-large" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h2>Import / Export Configs</h2>
          <button className="dialog-close" onClick={onClose}>✕</button>
        </div>

        <div className="dialog-body">
          {/* Export Section */}
          <div className="import-export-section">
            <h3>Export Configs</h3>

            <div className="export-actions">
              <button onClick={handleExportAll} className="btn btn-secondary">
                Export All ({configs.length})
              </button>
              <button
                onClick={handleExportSelected}
                className="btn btn-secondary"
                disabled={selectedIds.length === 0}
              >
                Export Selected ({selectedIds.length})
              </button>
            </div>

            {configs.length > 0 && (
              <div className="config-selection">
                <div className="selection-header">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={selectedIds.length === configs.length}
                      onChange={handleSelectAll}
                    />
                    <span>Select All</span>
                  </label>
                </div>
                <div className="selection-list">
                  {configs.map(config => (
                    <label key={config.id} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(config.id)}
                        onChange={() => handleToggleConfig(config.id)}
                      />
                      <span>{config.name} - {config.model}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="section-divider"></div>

          {/* Import Section */}
          <div className="import-export-section">
            <h3>Import Configs</h3>

            <div className="import-file-input">
              <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
                Choose JSON File
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
              </label>
              <span className="form-hint">Or paste JSON below</span>
            </div>

            <textarea
              className="import-textarea"
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder='Paste exported JSON here, e.g.:
[
  {
    "name": "My Config",
    "provider": "anthropic",
    "endpoint": "https://api.anthropic.com",
    "model": "claude-fable-5",
    "apiKey": "sk-ant-..."
  }
]'
              rows={10}
            />

            {importError && (
              <div className="error-message">
                {importError}
              </div>
            )}

            {importSuccess && (
              <div className="success-message">
                ✓ Import successful!
              </div>
            )}

            <button
              onClick={handleImport}
              className="btn btn-primary"
              disabled={isImporting || !importText.trim()}
            >
              {isImporting ? 'Importing...' : 'Import'}
            </button>
          </div>
        </div>

        <div className="dialog-footer">
          <button onClick={onClose} className="btn btn-secondary">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
