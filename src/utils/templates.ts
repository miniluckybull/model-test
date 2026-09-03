export const CONFIG_TEMPLATES = [
  {
    name: 'Claude Official',
    description: 'Official Anthropic Claude API',
    provider: 'anthropic' as const,
    endpoint: 'https://api.anthropic.com',
    model: 'claude-fable-5',
  },
  {
    name: 'OpenAI Official',
    description: 'Official OpenAI API',
    provider: 'openai' as const,
    endpoint: 'https://api.openai.com/v1',
    model: 'gpt-4o',
  },
  {
    name: 'Claude Proxy (Generic)',
    description: 'Generic Claude-compatible proxy',
    provider: 'anthropic' as const,
    endpoint: 'https://your-proxy.com',
    model: 'claude-fable-5',
  },
  {
    name: 'OpenAI Proxy (Generic)',
    description: 'Generic OpenAI-compatible proxy',
    provider: 'openai' as const,
    endpoint: 'https://your-proxy.com/v1',
    model: 'gpt-4o',
  },
]
