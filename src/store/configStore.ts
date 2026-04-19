import { create } from 'zustand';
import { TestResult, ConfigStore } from '../types';
import {
  addApiConfig,
  getAllConfigs,
  updateApiConfig,
  deleteApiConfig,
  mapBackendConfig,
} from '../services/tauriCommands';

export const useConfigStore = create<ConfigStore>((set, get) => ({
  configs: [],

  addConfig: async (config) => {
    const id = await addApiConfig({
      name: config.name,
      provider: config.provider,
      endpoint: config.endpoint,
      model: config.model,
      api_key: config.apiKey,
    });

    set((state) => ({
      configs: [
        ...state.configs,
        {
          ...config,
          id,
          status: 'idle' as const,
        },
      ],
    }));
  },

  duplicateConfig: async (id) => {
    const sourceConfig = get().configs.find((c) => c.id === id);
    if (!sourceConfig) return;

    const newName = `${sourceConfig.name} (Copy)`;
    const newId = await addApiConfig({
      name: newName,
      provider: sourceConfig.provider,
      endpoint: sourceConfig.endpoint,
      model: sourceConfig.model,
      api_key: sourceConfig.apiKey,
    });

    set((state) => ({
      configs: [
        ...state.configs,
        {
          ...sourceConfig,
          id: newId,
          name: newName,
          status: 'idle' as const,
          lastLatency: undefined,
          lastTokens: undefined,
          lastTestedAt: undefined,
          errorMessage: undefined,
        },
      ],
    }));
  },

  updateConfig: async (id, updates) => {
    const backendUpdate: Record<string, any> = { id };

    if (updates.name !== undefined) backendUpdate.name = updates.name;
    if (updates.provider !== undefined) backendUpdate.provider = updates.provider;
    if (updates.endpoint !== undefined) backendUpdate.endpoint = updates.endpoint;
    if (updates.model !== undefined) backendUpdate.model = updates.model;
    if (updates.apiKey !== undefined) {
      backendUpdate.api_key = updates.apiKey;
    }
    if (updates.status !== undefined) backendUpdate.status = updates.status;
    if (updates.lastLatency !== undefined) backendUpdate.last_latency = updates.lastLatency;
    if (updates.lastTokens !== undefined) backendUpdate.last_tokens = updates.lastTokens;
    if (updates.lastTestedAt !== undefined) backendUpdate.last_tested_at = updates.lastTestedAt;
    if (updates.errorMessage !== undefined) backendUpdate.error_message = updates.errorMessage;

    await updateApiConfig(backendUpdate as any);

    set((state) => ({
      configs: state.configs.map((config) =>
        config.id === id ? { ...config, ...updates } : config
      ),
    }));
  },

  deleteConfig: async (id) => {
    await deleteApiConfig(id);

    set((state) => ({
      configs: state.configs.filter((config) => config.id !== id),
    }));
  },

  setConfigStatus: (id, status) => {
    set((state) => ({
      configs: state.configs.map((config) =>
        config.id === id ? { ...config, status } : config
      ),
    }));
  },

  updateTestResult: (id, result: TestResult) => {
    set((state) => ({
      configs: state.configs.map((config) =>
        config.id === id
          ? {
              ...config,
              status: result.success ? 'ok' : 'failed',
              lastLatency: result.latencyMs,
              lastTokens: result.totalTokens,
              lastTestedAt: new Date().toISOString(),
              errorMessage: result.errorMessage,
            }
          : config
      ),
    }));
  },

  loadConfigs: async () => {
    try {
      const backendConfigs = await getAllConfigs();
      const configs = backendConfigs.map(mapBackendConfig);
      set({ configs });
    } catch (error) {
      console.error('Failed to load configs:', error);
    }
  },
}));
