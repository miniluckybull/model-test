export function validateConfig(
  name: string,
  endpoint: string,
  model: string,
  apiKey: string
): string[] {
  const errors: string[] = []

  // Validate name
  if (!name || name.trim().length === 0) {
    errors.push('请填写配置名称')
  }

  // Validate endpoint
  if (!endpoint || endpoint.trim().length === 0) {
    errors.push('请填写端点 URL')
  } else {
    try {
      const url = new URL(endpoint)
      if (!url.protocol.startsWith('http')) {
        errors.push('端点必须使用 HTTP 或 HTTPS 协议')
      }
    } catch {
      errors.push('端点必须是有效的 URL')
    }
  }

  // Validate model
  if (!model || model.trim().length === 0) {
    errors.push('请填写模型名称')
  }

  // Validate API key
  if (!apiKey || apiKey.trim().length === 0) {
    errors.push('请填写 API Key')
  } else if (apiKey.length < 10) {
    errors.push('API Key 似乎太短（至少 10 个字符）')
  }

  return errors
}

export function formatValidationErrors(errors: string[]): string {
  return errors.join('\n')
}

export function categorizeError(error: string): {
  category: 'network' | 'auth' | 'model' | 'unknown'
  suggestion: string
} {
  const lowerError = error.toLowerCase()

  if (
    lowerError.includes('network') ||
    lowerError.includes('connection') ||
    lowerError.includes('timeout') ||
    lowerError.includes('econnrefused')
  ) {
    return {
      category: 'network',
      suggestion: '请检查网络连接和端点 URL',
    }
  }

  if (
    lowerError.includes('unauthorized') ||
    lowerError.includes('401') ||
    lowerError.includes('403') ||
    lowerError.includes('api key') ||
    lowerError.includes('authentication')
  ) {
    return {
      category: 'auth',
      suggestion: '请检查 API Key 是否正确且有相应权限',
    }
  }

  if (
    lowerError.includes('model') ||
    lowerError.includes('404') ||
    lowerError.includes('not found')
  ) {
    return {
      category: 'model',
      suggestion: '请检查模型名称是否正确且可用',
    }
  }

  return {
    category: 'unknown',
    suggestion: '请查看下方错误详情',
  }
}

export function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  return JSON.stringify(error)
}
