function Header() {
  return (
    <header className="app-header">
      <div className="logo-mark" />
      <div className="header-title-group">
        <h1 className="header-title">MODEL TESTER</h1>
        <p className="header-subtitle">LOCAL MODEL RESOURCE DETECTION</p>
      </div>
      <div className="status-indicator">
        <span className="status-dot" />
        <span>Ready</span>
      </div>
    </header>
  )
}

export default Header
