import { useEffect, useState } from 'react'
import { useConfigStore } from './store/configStore'
import { listen } from '@tauri-apps/api/event'
import Header from './components/Header'
import ControlsGrid from './components/ControlsGrid'
import { Toolbar } from './components/Toolbar'
import { FilterBar } from './components/FilterBar'
import { StatisticsPanel } from './components/StatisticsPanel'

function App() {
  const loadConfigs = useConfigStore((state) => state.loadConfigs)
  const configs = useConfigStore((state) => state.configs)

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
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

  // 根据搜索和标签过滤配置
  const filteredConfigs = configs.filter(config => {
    const matchesSearch = !searchQuery ||
      config.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      config.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
      config.endpoint.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesTags = selectedTags.length === 0 ||
      selectedTags.every(tag => config.tags?.includes(tag))

    return matchesSearch && matchesTags
  })

  return (
    <div className="app">
      <Header />
      <main>
        <div className="toolbar-section">
          <Toolbar />
          <button
            onClick={() => setShowStats(!showStats)}
            className="btn btn-secondary"
          >
            {showStats ? '📊 隐藏统计' : '📊 显示统计'}
          </button>
        </div>

        {showStats && <StatisticsPanel />}

        <FilterBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedTags={selectedTags}
          onTagsChange={setSelectedTags}
        />

        <div className="filter-result-info">
          {filteredConfigs.length !== configs.length && (
            <span>显示 {filteredConfigs.length} / {configs.length} 个配置</span>
          )}
        </div>

        <ControlsGrid filteredConfigs={filteredConfigs} />
      </main>
    </div>
  )
}

export default App
