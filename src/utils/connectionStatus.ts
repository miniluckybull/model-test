import type { ApiConfig } from '../types'
import type { IconName } from '../components/Icon'

export const CONNECTION_STATUS_META: Record<
  ApiConfig['status'],
  { label: string; icon: IconName }
> = {
  idle: { label: '待检测', icon: 'clock' },
  running: { label: '检测中', icon: 'activity' },
  ok: { label: '连接正常', icon: 'check' },
  failed: { label: '连接失败', icon: 'x' },
}
