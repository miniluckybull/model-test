/** Claude Code tier mapping: ANTHROPIC_DEFAULT_{OPUS,SONNET,HAIKU}_MODEL */
export interface ModelTiers {
  opus?: string;
  sonnet?: string;
  haiku?: string;
}

/** Per-profile Claude apply details, persisted with the config profile */
export interface ApplySettings {
  thinkingMode?: 'auto' | 'enabled' | 'disabled';
  thinkingEffort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  maxTokens?: number;
}

export interface ApiConfig {
  id: string;
  name: string;
  provider: 'anthropic' | 'openai' | 'custom';
  endpoint: string;
  model: string;
  apiKey: string;
  tiers?: ModelTiers;
  applySettings?: ApplySettings;
  status: 'idle' | 'running' | 'ok' | 'failed';
  lastLatency?: number;
  lastTokens?: number;
  lastTestedAt?: string;
  errorMessage?: string;
  tags?: string[];
  order?: number;
}

export interface ProjectEntry {
  path: string;
  name: string;
  source: 'export' | 'manual';
  added_at: string;
  last_applied_at?: string;
}

export interface TargetConfigInfo {
  target: string;
  source_file?: string;
  full_path?: string;
  model?: string;
  tier_opus?: string;
  tier_sonnet?: string;
  tier_haiku?: string;
  has_secret: boolean;
  updated_at?: string;
}

export interface TestResult {
  configId: string;
  success: boolean;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  errorMessage?: string;
  modelResponse?: string;
  actualModel?: string;
}

export interface ClaudeConfig {
  env: Record<string, string>;
  model?: string;
}

export interface ClaudeConfigRequest {
  api_key: string;
  auth_token: string;
  base_url?: string;
  model?: string;
  custom_config_path?: string;
  thinking_mode?: 'auto' | 'enabled' | 'disabled';
  thinking_effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  max_tokens?: number;
  tiers?: ModelTiers;
}

export interface ConfigComparison {
  current_config: ClaudeConfig;
  new_config_json: string;
  config_path: string;
  current_config_json: string;
  detected_paths: string[];
}

export interface ExportToProjectResult {
  config_path: string;
  created_directory: boolean;
  /** true when config was written to settings.local.json (contains secrets) */
  used_local_settings: boolean;
  /** true when .claude/.gitignore was created/updated to exclude settings.local.json */
  gitignore_updated: boolean;
}

export interface ConfigStore {
  configs: ApiConfig[];
  addConfig: (config: Omit<ApiConfig, 'id' | 'status'>) => Promise<void>;
  duplicateConfig: (id: string) => Promise<void>;
  updateConfig: (id: string, updates: Partial<ApiConfig>) => Promise<void>;
  deleteConfig: (id: string) => Promise<void>;
  setConfigStatus: (id: string, status: ApiConfig['status']) => void;
  updateTestResult: (id: string, result: TestResult) => void;
  loadConfigs: () => Promise<void>;
  exportConfigs: (configIds?: string[]) => void;
  importConfigs: (jsonData: string) => Promise<void>;
  reorderConfigs: (configIds: string[]) => Promise<void>;
}

export interface ConfigTemplate {
  name: string;
  provider: 'anthropic' | 'openai' | 'custom';
  endpoint: string;
  model: string;
  description: string;
}

export interface ValidationError {
  field: string;
  message: string;
}
