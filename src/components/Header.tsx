import { useState } from 'react'
import { useConfigStore } from '../store/configStore'
import { testModel } from '../services/tauriCommands'

function Header() {
  const configs = useConfigStore((state) => state.configs)
  const setConfigStatus = useConfigStore((state) => state.setConfigStatus)
  const [isTestingAll, setIsTestingAll] = useState(false)

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
            console.error(`Failed to test ${config.name}:`, error)
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
    <header className="app-header">
      <div className="logo-mark" />
      <div className="header-title-group">
        <h1 className="header-title">MODEL TESTER</h1>
        <p className="header-subtitle">LOCAL MODEL RESOURCE DETECTION</p>
      </div>
      <button className="header-test-all" onClick={handleTestAll} disabled={!canTestAll}>
        <span>{isTestingAll ? 'Testing' : 'Test All'}</span>
        <span className="header-test-count">{configs.length}</span>
      </button>
    </header>
  )
}

export default Header
