function EmptyState() {
  return (
    <div className="empty-state">
      <div className="empty-icon">🔍</div>
      <h3 className="empty-title">No profiles yet</h3>
      <p className="empty-text">
        Add your first API profile to start testing model connectivity and performance.
      </p>
    </div>
  )
}

export default EmptyState
