import { ApiConfig } from '../types'
import ProfileCard from './ProfileCard'
import AddProfileTile from './AddProfileTile'

interface ControlsGridProps {
  configs: ApiConfig[]
}

function ControlsGrid({ configs }: ControlsGridProps) {
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
