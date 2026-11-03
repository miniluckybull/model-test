import { ApiConfig } from '../types'
import ProfileCard from './ProfileCard'
import AddProfileTile from './AddProfileTile'

interface ControlsGridProps {
  configs: ApiConfig[]
  compactMode: boolean
}

function ControlsGrid({ configs, compactMode }: ControlsGridProps) {
  return (
    <div className={`controls-grid ${compactMode ? 'is-compact' : ''}`}>
      {configs.map((config) => (
        <ProfileCard key={config.id} config={config} compactMode={compactMode} />
      ))}
      <AddProfileTile />
    </div>
  )
}

export default ControlsGrid
