import { ApiConfig } from '../types'
import ProfileCard from './ProfileCard'
import AddProfileTile from './AddProfileTile'

interface ControlsGridProps {
  filteredConfigs: ApiConfig[]
}

function ControlsGrid({ filteredConfigs }: ControlsGridProps) {
  return (
    <div className="controls-grid">
      {filteredConfigs.map((config) => (
        <ProfileCard key={config.id} config={config} />
      ))}
      <AddProfileTile />
    </div>
  )
}

export default ControlsGrid
