import { useState } from 'react'
import { useConfigStore } from '../store/configStore'
import { testModel } from '../services/tauriCommands'
import ImportExportDialog from './ImportExportDialog'
import TemplateDialog from './TemplateDialog'

function Header() {
  const configs = useConfigStore((state) => state.configs)
  const setConfigStatus = useConfigStore((state) => state.setConfigStatus)
  const [isTestingAll, setIsTestingAll] = useState(false)
  const [showImportExport, setShowImportExport] = useState(false)
  const [showTemplate, setShowTemplate] = useState(false)

  const handleTestAll = async () => {
    if (isTestingAll) return

    const configsToTest = [...configs]
    setIsTestingAll(true)
    configsToTest.forEach((config) => setConfigStatus(config.id, 'running'))

    try {
      await Promise.allSettled(
        configsToTest.map(async (config) => {
          try {
            await testModel(config.id)
          } catch (error) {
            console.error(`测试 ${config.name} 失败:`, error)
            setConfigStatus(config.id, 'failed')
          }
        })
      )
    } finally {
      setIsTestingAll(false)
    }
  }

  const canTestAll = configs.length > 0 && !isTestingAll

  return (
    <>
      <header className="app-header">
        <div className="logo-mark" />
        <div className="header-title-group">
          <h1 className="header-title">模型测试器</h1>
          <p className="header-subtitle">本地模型资源检测</p>
        </div>
        <div className="header-actions">
          <button className="header-button" onClick={() => setShowTemplate(true)}>
            📋 模板
          </button>
          <button className="header-button" onClick={() => setShowImportExport(true)}>
            📦 导入/导出
          </button>
          <button className="header-test-all" onClick={handleTestAll} disabled={!canTestAll}>
            <span>{isTestingAll ? '测试中' : '全部测试'}</span>
            <span className="header-test-count">{configs.length}</span>
          </button>
        </div>
      </header>

      {showImportExport && <ImportExportDialog onClose={() => setShowImportExport(false)} />}
      {showTemplate && <TemplateDialog onClose={() => setShowTemplate(false)} />}
    </>
  )
}

export default Header
