export const PROVIDERS = {
  anthropic: {
    name: 'Anthropic',
    defaultEndpoint: 'https://api.anthropic.com',
    defaultModel: 'claude-3-5-sonnet-latest',
  },
  openai: {
    name: 'OpenAI',
    defaultEndpoint: 'https://api.openai.com',
    defaultModel: 'gpt-4o-mini',
  },
  custom: {
    name: 'Custom',
    defaultEndpoint: '',
    defaultModel: '',
  },
} as const;

export const STATUS_COLORS = {
  idle: 'blue',
  running: 'amber',
  ok: 'green',
  failed: 'red',
} as const;

export const TEST_PROMPT = 'Hello, please respond with a short greeting.';
