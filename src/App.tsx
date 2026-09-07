import { useEffect, useState } from 'react'
import { useConfigStore } from './store/configStore'
import { listen } from '@tauri-apps/api/event'
import Header from './components/Header'
import ControlsGrid from './components/ControlsGrid'
import { StatisticsPanel } from './components/StatisticsPanel'

function App() {
  const loadConfigs = useConfigStore((state) => state.loadConfigs)
  const configs = useConfigStore((state) => state.configs)

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
      <Header />
      <main>
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
      </main>
    </div>
  )
}

export default App
