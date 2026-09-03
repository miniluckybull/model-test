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
      setImportError('请粘贴 JSON 数据')
      return
    }

    setImporting(true)
    setImportError(null)

    try {
      await importConfigs(importText)
      setImportText('')
      setShowImport(false)
      alert('导入成功！')
    } catch (error) {
      setImportError(error instanceof Error ? error.message : String(error))
    } finally {
      setImporting(false)
    }
  }

  const handleUseTemplate = async (template: typeof CONFIG_TEMPLATES[0]) => {
    const apiKey = prompt(`请输入 ${template.name} 的 API Key：`)
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
      alert('模板添加成功！')
    } catch (error) {
      alert(`添加模板失败：${error}`)
    }
  }

  return (
    <div className="toolbar">
      <button onClick={() => setShowTemplates(!showTemplates)} className="btn btn-secondary">
        📋 模板
      </button>
      <button onClick={handleExportAll} className="btn btn-secondary">
        📤 全部导出
      </button>
      <button onClick={() => setShowImport(!showImport)} className="btn btn-secondary">
        📥 导入
      </button>

      {showTemplates && (
        <div className="dropdown-panel">
          <div className="panel-header">
            <h3>配置模板</h3>
            <button onClick={() => setShowTemplates(false)} className="dialog-close">✕</button>
          </div>
          <div className="template-list">
            {CONFIG_TEMPLATES.map((template, index) => (
              <div key={index} className="template-item">
                <div className="template-info">
                  <strong>{template.name}</strong>
                  <span className="template-desc">{template.description}</span>
                  <code className="template-endpoint">{template.endpoint}</code>
                </div>
                <button onClick={() => handleUseTemplate(template)} className="btn btn-primary">
                  使用
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {showImport && (
        <div className="dropdown-panel">
          <div className="panel-header">
            <h3>导入配置</h3>
            <button onClick={() => setShowImport(false)} className="dialog-close">✕</button>
          </div>
          <div className="import-form">
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="在此粘贴 JSON 配置数据…"
              rows={10}
              className="import-textarea"
            />
            {importError && <div className="import-error">{importError}</div>}
            <div className="import-actions">
              <button onClick={() => setShowImport(false)} className="btn btn-secondary">
                取消
              </button>
              <button onClick={handleImport} disabled={importing} className="btn btn-primary">
                {importing ? '导入中…' : '导入'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
