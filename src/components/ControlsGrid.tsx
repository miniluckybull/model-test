import { useConfigStore } from '../store/configStore'
import ProfileCard from './ProfileCard'
import AddProfileTile from './AddProfileTile'

function ControlsGrid() {
  const configs = useConfigStore((state) => state.configs)

  return (
    <div className="controls-grid">
      {configs.map((config) => (
        <ProfileCard key={config.id} config={config} />
      ))}
      <AddProfileTile />
    </div>
  )
}

export default ControlsGrid
