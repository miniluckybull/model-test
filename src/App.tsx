import { useEffect, useState } from 'react'
import { useConfigStore } from './store/configStore'
import { listen } from '@tauri-apps/api/event'
import Header from './components/Header'
import ControlsGrid from './components/ControlsGrid'
import { StatisticsPanel } from './components/StatisticsPanel'
import ProjectApiConfigView from './components/ProjectApiConfigView'

export type AppTab = 'test' | 'projectApi'

function App() {
  const loadConfigs = useConfigStore((state) => state.loadConfigs)
  const configs = useConfigStore((state) => state.configs)

  const [activeTab, setActiveTab] = useState<AppTab>('test')
  const [showStats, setShowStats] = useState(false)

  useEffect(() => {
    loadConfigs()

    const setupListeners = async () => {
      await listen('auto-test-complete', () => {
        loadConfigs()
      })
    }
    setupListeners()
  }, [loadConfigs])

  return (
    <div className="app">
      <Header activeTab={activeTab} />
      <nav className="tab-bar">
        <button
          className={`tab-item ${activeTab === 'test' ? 'active' : ''}`}
          onClick={() => setActiveTab('test')}
        >
          🧪 模型测试
        </button>
        <button
          className={`tab-item ${activeTab === 'projectApi' ? 'active' : ''}`}
          onClick={() => setActiveTab('projectApi')}
        >
          🔑 项目api配置
        </button>
      </nav>
      <main className={activeTab === 'projectApi' ? 'main-full' : ''}>
        {activeTab === 'test' ? (
          <>
            <div className="toolbar-section">
              <button
                onClick={() => setShowStats(!showStats)}
                className="btn btn-secondary"
              >
                {showStats ? '📊 隐藏统计' : '📊 显示统计'}
              </button>
            </div>

            {showStats && <StatisticsPanel />}

            <ControlsGrid configs={configs} />
          </>
        ) : (
          <ProjectApiConfigView />
        )}
      </main>
    </div>
  )
}

export default App
