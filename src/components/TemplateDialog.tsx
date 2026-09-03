import { useState } from 'react'
import { useConfigStore } from '../store/configStore'
import { CONFIG_TEMPLATES } from '../utils/templates'

interface TemplateDialogProps {
  onClose: () => void
}

export default function TemplateDialog({ onClose }: TemplateDialogProps) {
  const addConfig = useConfigStore((state) => state.addConfig)
  const [apiKey, setApiKey] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState(CONFIG_TEMPLATES[0])
  const [isAdding, setIsAdding] = useState(false)

  const handleAdd = async () => {
    if (!apiKey.trim()) {
      alert('请输入 API Key')
      return
    }

    setIsAdding(true)
    try {
      await addConfig({
        name: selectedTemplate.name,
        provider: selectedTemplate.provider,
        endpoint: selectedTemplate.endpoint,
        model: selectedTemplate.model,
        apiKey: apiKey.trim(),
        tags: [],
      })
      onClose()
    } catch (error) {
      alert(`添加配置失败：${error}`)
    } finally {
      setIsAdding(false)
    }
  }

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-content" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h2>从模板添加</h2>
          <button className="dialog-close" onClick={onClose}>✕</button>
        </div>

        <div className="dialog-body">
          <div className="form-group">
            <label>模板</label>
            <select
              value={CONFIG_TEMPLATES.indexOf(selectedTemplate)}
              onChange={(e) => setSelectedTemplate(CONFIG_TEMPLATES[Number(e.target.value)])}
              className="form-select"
            >
              {CONFIG_TEMPLATES.map((template, index) => (
                <option key={index} value={index}>
                  {template.name} - {template.model}
                </option>
              ))}
            </select>
            <div className="form-hint">{selectedTemplate.description}</div>
          </div>

          <div className="form-group">
            <label>端点</label>
            <input
              type="text"
              value={selectedTemplate.endpoint}
              disabled
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label>模型</label>
            <input
              type="text"
              value={selectedTemplate.model}
              disabled
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label>API Key *</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="输入你的 API Key"
              className="form-input"
            />
          </div>
        </div>

        <div className="dialog-footer">
          <button onClick={onClose} className="btn btn-secondary" disabled={isAdding}>
            取消
          </button>
          <button onClick={handleAdd} className="btn btn-primary" disabled={isAdding}>
            {isAdding ? '添加中…' : '添加配置'}
          </button>
        </div>
      </div>
    </div>
  )
}
