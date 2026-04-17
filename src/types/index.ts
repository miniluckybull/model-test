export interface ApiConfig {
  id: string;
  name: string;
  provider: 'anthropic' | 'openai' | 'custom';
  endpoint: string;
  model: string;
  apiKey: string;
  status: 'idle' | 'running' | 'ok' | 'failed';
  lastLatency?: number;
  lastTokens?: number;
  lastTestedAt?: string;
  errorMessage?: string;
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
}
