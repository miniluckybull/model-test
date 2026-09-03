import { ApiConfig } from '../types'
import { SelectableProfileCard } from './SelectableProfileCard'
import AddProfileTile from './AddProfileTile'

interface ControlsGridProps {
  filteredConfigs: ApiConfig[]
  selectedIds: string[]
  onToggleSelect: (id: string) => void
}

function ControlsGrid({ filteredConfigs, selectedIds, onToggleSelect }: ControlsGridProps) {
  return (
    <div className="controls-grid">
      {filteredConfigs.map((config) => (
        <SelectableProfileCard
          key={config.id}
          config={config}
          isSelected={selectedIds.includes(config.id)}
          onToggleSelect={onToggleSelect}
        />
      ))}
      <AddProfileTile />
    </div>
  )
}

export default ControlsGrid
