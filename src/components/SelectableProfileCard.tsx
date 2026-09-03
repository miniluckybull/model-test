import { ApiConfig } from '../types'
import ProfileCard from './ProfileCard'

interface SelectableProfileCardProps {
  config: ApiConfig
  isSelected: boolean
  onToggleSelect: (id: string) => void
}

export function SelectableProfileCard({ config, isSelected, onToggleSelect }: SelectableProfileCardProps) {
  return (
    <div className={`profile-card-wrapper ${isSelected ? 'selected' : ''}`}>
      <input
        type="checkbox"
        checked={isSelected}
        onChange={() => onToggleSelect(config.id)}
        className="card-select-checkbox"
        onClick={(e) => e.stopPropagation()}
      />
      <ProfileCard config={config} />
    </div>
  )
}
