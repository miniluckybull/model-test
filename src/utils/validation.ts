export function validateConfig(
  name: string,
  endpoint: string,
  model: string,
  apiKey: string
): string[] {
  const errors: string[] = []

  // Validate name
  if (!name || name.trim().length === 0) {
    errors.push('Configuration name is required')
  }

  // Validate endpoint
  if (!endpoint || endpoint.trim().length === 0) {
    errors.push('Endpoint URL is required')
  } else {
    try {
      const url = new URL(endpoint)
      if (!url.protocol.startsWith('http')) {
        errors.push('Endpoint must use HTTP or HTTPS protocol')
      }
    } catch {
      errors.push('Endpoint must be a valid URL')
    }
  }

  // Validate model
  if (!model || model.trim().length === 0) {
    errors.push('Model name is required')
  }

  // Validate API key
  if (!apiKey || apiKey.trim().length === 0) {
    errors.push('API key is required')
  } else if (apiKey.length < 10) {
    errors.push('API key seems too short (minimum 10 characters)')
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
      suggestion: 'Check your internet connection and endpoint URL',
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
      suggestion: 'Check your API key is correct and has proper permissions',
    }
  }

  if (
    lowerError.includes('model') ||
    lowerError.includes('404') ||
    lowerError.includes('not found')
  ) {
    return {
      category: 'model',
      suggestion: 'Check the model name is correct and available',
    }
  }

  return {
    category: 'unknown',
    suggestion: 'Check the error details below',
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
