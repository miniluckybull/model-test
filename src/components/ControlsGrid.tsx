import { useConfigStore } from '../store/configStore'
import { testModel } from '../services/tauriCommands'
import ProfileCard from './ProfileCard'
import AddProfileTile from './AddProfileTile'

function ControlsGrid() {
  const configs = useConfigStore((state) => state.configs)
  const setConfigStatus = useConfigStore((state) => state.setConfigStatus)

  const handleTestAll = async () => {
    for (const config of configs) {
      setConfigStatus(config.id, 'running')
      try {
        await testModel(config.id)
      } catch (error) {
        console.error(`Failed to test ${config.name}:`, error)
        setConfigStatus(config.id, 'failed')
      }
    }
  }

  return (
    <div>
      {configs.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
          <button className="btn btn-primary" onClick={handleTestAll}>
            Test All ({configs.length})
          </button>
        </div>
      )}
      <div className="controls-grid">
        {configs.map((config) => (
          <ProfileCard key={config.id} config={config} />
        ))}
        <AddProfileTile />
      </div>
    </div>
  )
}

export default ControlsGrid
