import { useEffect, useState } from 'react'
import { useConfigStore } from './store/configStore'
import { listen } from '@tauri-apps/api/event'
import Header from './components/Header'
import ControlsGrid from './components/ControlsGrid'
import { Toolbar } from './components/Toolbar'
import { FilterBar } from './components/FilterBar'
import { StatisticsPanel } from './components/StatisticsPanel'
import { BatchTestPanel } from './components/BatchTestPanel'

function App() {
  const loadConfigs = useConfigStore((state) => state.loadConfigs)
  const configs = useConfigStore((state) => state.configs)
  const deleteConfig = useConfigStore((state) => state.deleteConfig)

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [showStats, setShowStats] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [showBatchTest, setShowBatchTest] = useState(false)

  useEffect(() => {
    loadConfigs()

    const setupListeners = async () => {
      await listen('auto-test-complete', () => {
        loadConfigs()
      })
    }
    setupListeners()
  }, [loadConfigs])

  // Filter configs based on search and tags
  const filteredConfigs = configs.filter(config => {
    const matchesSearch = !searchQuery ||
      config.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      config.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
      config.endpoint.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesTags = selectedTags.length === 0 ||
      selectedTags.every(tag => config.tags?.includes(tag))

    return matchesSearch && matchesTags
  })

  const handleSelectAll = () => {
    if (selectedIds.length === filteredConfigs.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(filteredConfigs.map(c => c.id))
    }
  }

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const handleBatchDelete = async () => {
    if (!confirm(`Delete ${selectedIds.length} configurations?`)) return

    for (const id of selectedIds) {
      await deleteConfig(id)
    }
    setSelectedIds([])
  }

  const handleBatchTest = () => {
    setShowBatchTest(true)
  }

  return (
    <div className="app">
      <Header />
      <main>
        <div className="toolbar-section">
          <Toolbar />
          <button
            onClick={() => setShowStats(!showStats)}
            className="stats-toggle-btn"
          >
            {showStats ? '📊 Hide Stats' : '📊 Show Stats'}
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
            <span>Showing {filteredConfigs.length} of {configs.length} configurations</span>
          )}
        </div>

        {filteredConfigs.length > 0 && (
          <div className="batch-actions-bar">
            <label className="select-all-checkbox">
              <input
                type="checkbox"
                checked={selectedIds.length === filteredConfigs.length && filteredConfigs.length > 0}
                onChange={handleSelectAll}
              />
              <span>Select All</span>
            </label>

            {selectedIds.length > 0 && (
              <div className="batch-actions">
                <span className="selected-count">{selectedIds.length} selected</span>
                <button onClick={handleBatchTest} className="batch-test-btn">
                  🧪 Batch Test
                </button>
                <button onClick={handleBatchDelete} className="batch-delete-btn">
                  🗑️ Delete
                </button>
                <button onClick={() => setSelectedIds([])} className="deselect-btn">
                  Clear
                </button>
              </div>
            )}
          </div>
        )}

        {showBatchTest && selectedIds.length > 0 && (
          <BatchTestPanel
            selectedIds={selectedIds}
            onClose={() => setShowBatchTest(false)}
          />
        )}

        <ControlsGrid
          filteredConfigs={filteredConfigs}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
        />
      </main>
    </div>
  )
}

export default App
