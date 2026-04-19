import { useConfigStore } from '../store/configStore'
import CompactCard from './CompactCard'

export default function CompactView() {
  const configs = useConfigStore((state) => state.configs)

  return (
    <div className="compact-view">
      <div className="compact-header">
        <h1>Model Tester</h1>
        <span className="compact-count">{configs.length} 个配置</span>
      </div>
      <div className="compact-grid">
        {configs.map((config) => (
          <CompactCard key={config.id} config={config} />
        ))}
      </div>
    </div>
  )
}
