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
    name: '自定义',
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

export const THINKING_MODES = ['auto', 'enabled', 'disabled'] as const;
export const THINKING_MODE_LABELS = ['自动（推荐）', '启用', '禁用'];
export const THINKING_EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
export const THINKING_EFFORT_LABELS = ['低', '中', '高（默认）', '较高', '最高'];

export const TIER_KEYS = ['opus', 'sonnet', 'haiku'] as const;
export type TierKey = (typeof TIER_KEYS)[number];

export const TIER_HINTS: Record<TierKey, string> = {
  opus: 'opus 别名 / opusplan 规划阶段',
  sonnet: 'sonnet 别名 / opusplan 执行阶段',
  haiku: 'haiku 别名 + 后台轻量任务，建议选低成本模型省 token',
};
