function EmptyState() {
  return (
    <div className="empty-state">
      <div className="empty-icon">🔍</div>
      <h3 className="empty-title">还没有配置</h3>
      <p className="empty-text">
        添加你的第一个 API 配置，开始测试模型连通性与性能。
      </p>
    </div>
  )
}

export default EmptyState
