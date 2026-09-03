import { useState } from 'react'
import { useConfigStore } from '../store/configStore'

interface FilterBarProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  selectedTags: string[]
  onTagsChange: (tags: string[]) => void
}

export function FilterBar({ searchQuery, onSearchChange, selectedTags, onTagsChange }: FilterBarProps) {
  const configs = useConfigStore((state) => state.configs)
  const [showTagFilter, setShowTagFilter] = useState(false)

  // Extract all unique tags from configs
  const allTags = Array.from(
    new Set(configs.flatMap(c => c.tags || []))
  ).sort()

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      onTagsChange(selectedTags.filter(t => t !== tag))
    } else {
      onTagsChange([...selectedTags, tag])
    }
  }

  return (
    <div className="filter-bar">
      <div className="search-box">
        <input
          type="text"
          placeholder="Search configurations..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="search-input"
        />
        {searchQuery && (
          <button onClick={() => onSearchChange('')} className="clear-search-btn">
            ✕
          </button>
        )}
      </div>

      {allTags.length > 0 && (
        <div className="tag-filter">
          <button
            onClick={() => setShowTagFilter(!showTagFilter)}
            className="tag-filter-btn"
          >
            🏷️ Tags {selectedTags.length > 0 && `(${selectedTags.length})`}
          </button>

          {showTagFilter && (
            <div className="tag-dropdown">
              <div className="tag-dropdown-header">
                <span>Filter by tags</span>
                {selectedTags.length > 0 && (
                  <button onClick={() => onTagsChange([])} className="clear-tags-btn">
                    Clear
                  </button>
                )}
              </div>
              <div className="tag-list">
                {allTags.map(tag => (
                  <label key={tag} className="tag-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedTags.includes(tag)}
                      onChange={() => toggleTag(tag)}
                    />
                    <span>{tag}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {(searchQuery || selectedTags.length > 0) && (
        <div className="active-filters">
          {searchQuery && (
            <span className="filter-chip">
              Search: "{searchQuery}"
              <button onClick={() => onSearchChange('')}>✕</button>
            </span>
          )}
          {selectedTags.map(tag => (
            <span key={tag} className="filter-chip">
              {tag}
              <button onClick={() => toggleTag(tag)}>✕</button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
