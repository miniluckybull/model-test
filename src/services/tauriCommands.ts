import { invoke } from '@tauri-apps/api/core';
import {
  ApiConfig,
  ApplySettings,
  ClaudeConfigRequest,
  ConfigComparison,
  ExportToProjectResult,
  ModelTiers,
  ProjectEntry,
  TargetConfigInfo,
} from '../types';

/** backend serde shape of ApplySettings */
interface BackendApplySettings {
  thinking_mode?: string;
  thinking_effort?: string;
  max_tokens?: number;
}

interface CreateConfigPayload {
  name: string;
  provider: string;
  endpoint: string;
  model: string;
  api_key: string;
  tiers?: ModelTiers;
  apply_settings?: BackendApplySettings | null;
  tags?: string[];
  order?: number;
}

interface UpdateConfigPayload {
  id: string;
  name?: string;
  provider?: string;
  endpoint?: string;
  model?: string;
  api_key?: string;
  /** outer undefined = keep; null = clear */
  tiers?: ModelTiers | null;
  /** outer undefined = keep; null = clear */
  apply_settings?: BackendApplySettings | null;
  status?: string;
  last_latency?: number;
  last_tokens?: number;
  last_tested_at?: string;
  error_message?: string;
  tags?: string[];
  order?: number;
}

interface BackendConfig {
  id: string;
  name: string;
  provider: string;
  endpoint: string;
  model: string;
  api_key: string;
  tiers?: ModelTiers;
  apply_settings?: BackendApplySettings;
  status: string;
  last_latency?: number;
  last_tokens?: number;
  last_tested_at?: string;
  error_message?: string;
  tags: string[];
  order?: number;
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

// Claude Code configuration commands
export async function getClaudeConfig(customConfigPath?: string): Promise<ConfigComparison> {
  return invoke<ConfigComparison>('get_claude_config', { customConfigPath });
}

export async function previewClaudeConfig(request: ClaudeConfigRequest): Promise<ConfigComparison> {
  return invoke<ConfigComparison>('preview_claude_config', { request });
}

export async function applyClaudeConfig(request: ClaudeConfigRequest): Promise<string> {
  return invoke<string>('apply_claude_config', { request });
}

export async function getClaudeConfigPath(customConfigPath?: string): Promise<string> {
  return invoke<string>('get_claude_config_path_command', { customConfigPath });
}

export async function applyCustomClaudeConfig(configJson: string, customConfigPath?: string): Promise<string> {
  return invoke<string>('apply_custom_claude_config', { configJson, customConfigPath });
}

export async function exportToProject(request: ClaudeConfigRequest, projectPath: string): Promise<ExportToProjectResult> {
  return invoke<ExportToProjectResult>('export_to_project', { request, projectPath });
}

// Project registry & target scan commands
export async function listProjects(): Promise<ProjectEntry[]> {
  return invoke<ProjectEntry[]>('list_projects');
}

export async function registerProject(path: string): Promise<ProjectEntry> {
  return invoke<ProjectEntry>('register_project', { path });
}

export async function removeProject(path: string): Promise<void> {
  return invoke('remove_project', { path });
}

export async function scanClaudeTarget(path?: string): Promise<TargetConfigInfo> {
  return invoke<TargetConfigInfo>('scan_claude_target', { path: path ?? null });
}

/** create an empty project dir under parent and register it */
export async function createProjectDir(parent: string, name: string): Promise<ProjectEntry> {
  return invoke<ProjectEntry>('create_project_dir', { parent, name });
}

/** git init a project dir; resolves false when a repo already exists */
export async function initGitRepo(path: string): Promise<boolean> {
  return invoke<boolean>('init_git_repo', { path });
}

/** open a Terminal.app window at the directory, optionally starting Claude Code (macOS) */
export async function openTerminalAt(path: string, launchClaude = false): Promise<void> {
  return invoke('open_terminal_at', { path, launchClaude });
}

export function toBackendApplySettings(s?: ApplySettings | null): BackendApplySettings | null | undefined {
  if (s === null) return null;
  if (!s) return undefined;
  return {
    thinking_mode: s.thinkingMode,
    thinking_effort: s.thinkingEffort,
    max_tokens: s.maxTokens,
  };
}

export function fromBackendApplySettings(s?: BackendApplySettings): ApplySettings | undefined {
  if (!s) return undefined;
  return {
    thinkingMode: s.thinking_mode as ApplySettings['thinkingMode'],
    thinkingEffort: s.thinking_effort as ApplySettings['thinkingEffort'],
    maxTokens: s.max_tokens,
  };
}

export interface ClaudeRequestOptions {
  customConfigPath?: string;
  thinkingMode?: 'auto' | 'enabled' | 'disabled';
  thinkingEffort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  maxTokens?: number;
  /** overrides the profile's stored tiers (e.g. dialog edit state) */
  tiers?: ModelTiers;
}

/** Single source of truth for building a ClaudeConfigRequest from a profile */
export function buildClaudeRequest(config: ApiConfig, opts: ClaudeRequestOptions = {}): ClaudeConfigRequest {
  const stored = config.applySettings;
  const maxTokens = opts.maxTokens ?? stored?.maxTokens;
  return {
    api_key: config.apiKey,
    auth_token: config.apiKey,
    base_url: config.endpoint,
    model: config.model,
    custom_config_path: opts.customConfigPath,
    thinking_mode: opts.thinkingMode ?? stored?.thinkingMode ?? 'auto',
    thinking_effort: opts.thinkingEffort ?? stored?.thinkingEffort ?? 'high',
    max_tokens: maxTokens && maxTokens > 0 ? maxTokens : 8192,
    tiers: opts.tiers ?? config.tiers,
  };
}

export function mapBackendConfig(backend: BackendConfig): ApiConfig {
  return {
    id: backend.id,
    name: backend.name,
    provider: backend.provider as ApiConfig['provider'],
    endpoint: backend.endpoint,
    model: backend.model,
    apiKey: backend.api_key,
    tiers: backend.tiers,
    applySettings: fromBackendApplySettings(backend.apply_settings),
    status: backend.status as ApiConfig['status'],
    lastLatency: backend.last_latency,
    lastTokens: backend.last_tokens,
    lastTestedAt: backend.last_tested_at,
    errorMessage: backend.error_message,
    tags: backend.tags,
    order: backend.order,
  };
}
