import { useState } from 'react'
import { useConfigStore } from '../store/configStore'
import { testModel } from '../services/tauriCommands'
import ImportExportDialog from './ImportExportDialog'
import TemplateDialog from './TemplateDialog'
import { Icon } from './Icon'
import type { AppTab } from '../App'

interface HeaderProps {
  activeTab: AppTab
}

function Header({ activeTab }: HeaderProps) {
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
  const isModelTab = activeTab === 'test'

  return (
    <>
      <header className="app-header">
        <div className="header-actions">
          <button className="header-button" onClick={() => setShowTemplate(true)}>
            <Icon name="template" size={16} />
            <span>配置模板</span>
          </button>
          <button className="header-button" onClick={() => setShowImportExport(true)}>
            <Icon name="import-export" size={16} />
            <span>导入 / 导出</span>
          </button>
          {isModelTab && (
            <button className="header-test-all" onClick={handleTestAll} disabled={!canTestAll}>
              <Icon name="activity" size={17} className={isTestingAll ? 'is-spinning' : ''} />
              <span>{isTestingAll ? '正在测试' : '全部测试'}</span>
              <span className="header-test-count">{configs.length}</span>
            </button>
          )}
        </div>
      </header>

      {showImportExport && <ImportExportDialog onClose={() => setShowImportExport(false)} />}
      {showTemplate && <TemplateDialog onClose={() => setShowTemplate(false)} />}
    </>
  )
}

export default Header
