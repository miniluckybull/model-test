import { useEffect, useMemo, useState } from 'react'
import { listen } from '@tauri-apps/api/event'
import { useConfigStore } from './store/configStore'
import Header from './components/Header'
import ControlsGrid from './components/ControlsGrid'
import { StatisticsPanel } from './components/StatisticsPanel'
import ProjectApiConfigView from './components/ProjectApiConfigView'
import { BrandMark, Icon } from './components/Icon'
import type { TestResult } from './types'

export type AppTab = 'test' | 'projectApi'

const GITHUB_REPO_URL = 'https://github.com/miniluckybull/model-test'

function App() {
  const loadConfigs = useConfigStore((state) => state.loadConfigs)
  const configs = useConfigStore((state) => state.configs)
  const updateTestResult = useConfigStore((state) => state.updateTestResult)

  const [activeTab, setActiveTab] = useState<AppTab>('test')
  const [showStats, setShowStats] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [compactMode, setCompactMode] = useState(false)
  const [repoCopyStatus, setRepoCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle')

  useEffect(() => {
    loadConfigs()

    let disposed = false
    let unlisteners: Array<() => void> = []
    const setupListeners = async () => {
      const listeners = await Promise.all([
        listen('test-complete', (event: any) => {
          const payload = event.payload
          const result: TestResult = {
            configId: payload.config_id,
            success: payload.success,
            latencyMs: payload.latency_ms,
            promptTokens: payload.prompt_tokens,
            completionTokens: payload.completion_tokens,
            totalTokens: payload.total_tokens,
            errorMessage: payload.error_message,
            modelResponse: payload.model_response,
            actualModel: payload.actual_model,
          }
          updateTestResult(payload.config_id, result)
        }),
        listen('auto-test-complete', () => {
          loadConfigs()
        }),
      ])
      if (disposed) {
        listeners.forEach((unlisten) => unlisten())
      } else {
        unlisteners = listeners
      }
    }
    setupListeners().catch((error) => console.error('Failed to listen for test events:', error))

    return () => {
      disposed = true
      unlisteners.forEach((unlisten) => unlisten())
    }
  }, [loadConfigs, updateTestResult])

  const overview = useMemo(() => {
    const latencies = configs.flatMap((config) =>
      typeof config.lastLatency === 'number' ? [config.lastLatency] : []
    )
    return {
      available: configs.filter((config) => config.status === 'ok').length,
      tested: configs.filter((config) => config.lastTestedAt).length,
      averageLatency: latencies.length
        ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length)
        : null,
    }
  }, [configs])

  const handleCopyRepoUrl = async () => {
    try {
      if (!navigator.clipboard) throw new Error('Clipboard API unavailable')
      await navigator.clipboard.writeText(GITHUB_REPO_URL)
      setRepoCopyStatus('copied')
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = GITHUB_REPO_URL
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      const copied = document.execCommand('copy')
      textarea.remove()
      setRepoCopyStatus(copied ? 'copied' : 'error')
    }
    window.setTimeout(() => setRepoCopyStatus('idle'), 2200)
  }

  return (
    <div className={`app ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <aside className="app-sidebar" id="workspace-sidebar">
        <button
          className="sidebar-toggle"
          onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
          aria-label={sidebarCollapsed ? '展开工作台' : '收起工作台'}
          aria-expanded={!sidebarCollapsed}
          aria-controls="workspace-sidebar"
          title={sidebarCollapsed ? '展开工作台' : '收起工作台'}
        >
          <Icon name={sidebarCollapsed ? 'chevrons-right' : 'chevrons-left'} size={14} />
        </button>
        <div className="brand-lockup">
          <BrandMark />
          <div className="brand-type">
            <strong>MODEL</strong>
            <span>TESTER</span>
          </div>
          <span className="brand-edition">LAB</span>
        </div>

        <div className="sidebar-rule" />
        <p className="sidebar-label">工作区 / WORKSPACE</p>
        <nav className="side-nav" aria-label="主导航">
          <button
            className={`side-nav-item ${activeTab === 'test' ? 'active' : ''}`}
            onClick={() => setActiveTab('test')}
            aria-current={activeTab === 'test' ? 'page' : undefined}
            aria-label="模型资源"
            title={sidebarCollapsed ? '模型资源' : undefined}
          >
            <span className="side-nav-icon"><Icon name="layers" size={19} /></span>
            <span className="side-nav-copy">
              <strong>模型资源</strong>
              <small>连接与性能</small>
            </span>
            <span className="side-nav-index">01</span>
          </button>
          <button
            className={`side-nav-item ${activeTab === 'projectApi' ? 'active' : ''}`}
            onClick={() => setActiveTab('projectApi')}
            aria-current={activeTab === 'projectApi' ? 'page' : undefined}
            aria-label="项目接入"
            title={sidebarCollapsed ? '项目接入' : undefined}
          >
            <span className="side-nav-icon"><Icon name="route" size={19} /></span>
            <span className="side-nav-copy">
              <strong>项目接入</strong>
              <small>配置与启动</small>
            </span>
            <span className="side-nav-index">02</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="share-actions">
            <a
              className="share-github"
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noreferrer"
              title="打开 GitHub 开源仓库"
              aria-label="打开 GitHub 开源仓库"
            >
              <Icon name="github" size={18} />
              <span className="share-copy">
                <strong>GitHub 开源</strong>
                <small>miniluckybull / model-test</small>
              </span>
              <Icon name="external-link" size={13} className="share-external" />
            </a>
            <button
              className="share-copy-button"
              onClick={handleCopyRepoUrl}
              title="复制 GitHub 分享链接"
              aria-label="复制 GitHub 分享链接"
            >
              <Icon name={repoCopyStatus === 'copied' ? 'check' : 'copy'} size={15} />
            </button>
          </div>
          {repoCopyStatus !== 'idle' && (
            <span className={`share-feedback ${repoCopyStatus}`} role="status">
              {repoCopyStatus === 'copied' ? '链接已复制，可分享给他人' : '复制失败，请打开仓库复制地址'}
            </span>
          )}
          <div className="sidebar-version">
            <span>OPEN SOURCE</span>
            <span>v0.2.0</span>
          </div>
        </div>
      </aside>

      <div className="app-workspace">
        <Header
          activeTab={activeTab}
          compactMode={compactMode}
          onToggleCompactMode={() => setCompactMode((compact) => !compact)}
        />
        <main className={activeTab === 'projectApi' ? 'main-full' : 'main-models'}>
          {activeTab === 'test' ? (
            <>
              <section className="resource-overview" aria-label="模型资源概览">
                <div className="overview-primary">
                  <span className="overview-kicker">RESOURCE STATUS</span>
                  <div className="overview-availability">
                    <strong>{String(overview.available).padStart(2, '0')}</strong>
                    <span>/ {configs.length} 个端点可用</span>
                  </div>
                </div>
                <div className="overview-metric">
                  <span>已验证</span>
                  <strong>{overview.tested}<small> / {configs.length}</small></strong>
                </div>
                <div className="overview-metric">
                  <span>平均延迟</span>
                  <strong>{overview.averageLatency ?? '—'}<small>{overview.averageLatency !== null ? ' ms' : ''}</small></strong>
                </div>
                <button
                  className={`overview-stats-toggle ${showStats ? 'active' : ''}`}
                  onClick={() => setShowStats(!showStats)}
                  aria-expanded={showStats}
                >
                  <Icon name="chart" size={17} />
                  <span>{showStats ? '收起统计' : '详细统计'}</span>
                  <Icon name="chevron-down" size={14} className={showStats ? 'rotated' : ''} />
                </button>
              </section>

              {showStats && <StatisticsPanel />}

              <div className="section-heading">
                <div>
                  <span className="section-kicker">API PROFILES</span>
                  <h2>配置档案</h2>
                </div>
                <p><span className="section-heading-dot" />选择任意端点，运行一次连接测试</p>
              </div>
              <ControlsGrid configs={configs} compactMode={compactMode} />
            </>
          ) : (
            <ProjectApiConfigView />
          )}
        </main>
      </div>
    </div>
  )
}

export default App
