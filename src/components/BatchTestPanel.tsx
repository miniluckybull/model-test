import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

interface BatchTestPanelProps {
  selectedIds: string[]
  onClose: () => void
}

export function BatchTestPanel({ selectedIds, onClose }: BatchTestPanelProps) {
  const [testing, setTesting] = useState(false)
  const [completed, setCompleted] = useState(0)
  const [total, setTotal] = useState(selectedIds.length)

  useEffect(() => {
    let unlisten: (() => void) | undefined

    const setupListeners = async () => {
      unlisten = await listen('test-complete', () => {
        setCompleted(prev => prev + 1)
      })
    }

    setupListeners()

    return () => {
      if (unlisten) unlisten()
    }
  }, [])

  const handleBatchTest = async () => {
    setTesting(true)
    setCompleted(0)
    setTotal(selectedIds.length)

    try {
      await invoke('batch_test_models', {
        configIds: selectedIds,
        maxConcurrent: 3,
      })
    } catch (error) {
      console.error('Batch test failed:', error)
    } finally {
      setTesting(false)
    }
  }

  const progress = total > 0 ? (completed / total) * 100 : 0

  return (
    <div className="batch-test-panel">
      <div className="panel-header">
        <h3>Batch Test {selectedIds.length} Configurations</h3>
        <button onClick={onClose} className="dialog-close">✕</button>
      </div>

      <div className="batch-test-content">
        {!testing && completed === 0 && (
          <div className="batch-test-prompt">
            <p>Test {selectedIds.length} configurations simultaneously</p>
            <button onClick={handleBatchTest} className="btn btn-primary">
              Start Batch Test
            </button>
          </div>
        )}

        {testing && (
          <div className="batch-test-progress">
            <div className="progress-stats">
              <span>Testing: {completed} / {total}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <div className="progress-note">
              Running up to 3 tests concurrently...
            </div>
          </div>
        )}

        {!testing && completed > 0 && (
          <div className="batch-test-complete">
            <div className="complete-icon">✓</div>
            <p>Batch test complete: {completed} / {total} tested</p>
            <button onClick={onClose} className="btn btn-primary">
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
