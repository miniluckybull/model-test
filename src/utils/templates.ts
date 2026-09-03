export const CONFIG_TEMPLATES = [
  {
    name: 'Claude 官方',
    description: '官方 Anthropic Claude API',
    provider: 'anthropic' as const,
    endpoint: 'https://api.anthropic.com',
    model: 'claude-fable-5',
  },
  {
    name: 'OpenAI 官方',
    description: '官方 OpenAI API',
    provider: 'openai' as const,
    endpoint: 'https://api.openai.com/v1',
    model: 'gpt-4o',
  },
  {
    name: 'Claude 代理（通用）',
    description: '通用 Claude 兼容代理',
    provider: 'anthropic' as const,
    endpoint: 'https://your-proxy.com',
    model: 'claude-fable-5',
  },
  {
    name: 'OpenAI 代理（通用）',
    description: '通用 OpenAI 兼容代理',
    provider: 'openai' as const,
    endpoint: 'https://your-proxy.com/v1',
    model: 'gpt-4o',
  },
]
