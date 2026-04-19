import { invoke } from '@tauri-apps/api/core';
import { ApiConfig } from '../types';

interface CreateConfigPayload {
  name: string;
  provider: string;
  endpoint: string;
  model: string;
  api_key: string;
}

interface UpdateConfigPayload {
  id: string;
  name?: string;
  provider?: string;
  endpoint?: string;
  model?: string;
  api_key?: string;
  status?: string;
  last_latency?: number;
  last_tokens?: number;
  last_tested_at?: string;
  error_message?: string;
}

interface BackendConfig {
  id: string;
  name: string;
  provider: string;
  endpoint: string;
  model: string;
  api_key: string;
  status: string;
  last_latency?: number;
  last_tokens?: number;
  last_tested_at?: string;
  error_message?: string;
}

export async function addApiConfig(config: CreateConfigPayload): Promise<string> {
  return invoke<string>('add_api_config', { config });
}

export async function getAllConfigs(): Promise<BackendConfig[]> {
  return invoke<BackendConfig[]>('get_all_configs');
}

export async function updateApiConfig(update: UpdateConfigPayload): Promise<void> {
  return invoke('update_api_config', { update });
}

export async function deleteApiConfig(id: string): Promise<void> {
  return invoke('delete_api_config', { id });
}

export async function testModel(configId: string): Promise<void> {
  return invoke('test_model', { configId });
}

export function mapBackendConfig(backend: BackendConfig): ApiConfig {
  return {
    id: backend.id,
    name: backend.name,
    provider: backend.provider as ApiConfig['provider'],
    endpoint: backend.endpoint,
    model: backend.model,
    apiKey: backend.api_key,
    status: backend.status as ApiConfig['status'],
    lastLatency: backend.last_latency,
    lastTokens: backend.last_tokens,
    lastTestedAt: backend.last_tested_at,
    errorMessage: backend.error_message,
  };
}
