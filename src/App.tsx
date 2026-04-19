import { useEffect } from 'react'
import { useConfigStore } from './store/configStore'
import { listen } from '@tauri-apps/api/event'
import Header from './components/Header'
import ControlsGrid from './components/ControlsGrid'

function App() {
  const loadConfigs = useConfigStore((state) => state.loadConfigs)

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
        <ControlsGrid />
      </main>
    </div>
  )
}

export default App
