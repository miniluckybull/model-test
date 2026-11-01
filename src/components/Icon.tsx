import type { ReactNode } from 'react'

export type IconName =
  | 'activity'
  | 'arrow-right'
  | 'chart'
  | 'check'
  | 'chevron-down'
  | 'chevrons-left'
  | 'chevrons-right'
  | 'clock'
  | 'copy'
  | 'edit'
  | 'folder'
  | 'folder-plus'
  | 'globe'
  | 'import-export'
  | 'key'
  | 'layers'
  | 'plus'
  | 'route'
  | 'shield'
  | 'spark'
  | 'template'
  | 'terminal'
  | 'trash'
  | 'x'

interface IconProps {
  name: IconName
  size?: number
  className?: string
  strokeWidth?: number
}

const paths: Record<IconName, ReactNode> = {
  activity: <><path d="M3 12h4l2.5-7 5 14 2.5-7h4" /></>,
  'arrow-right': <><path d="M5 12h14M13 6l6 6-6 6" /></>,
  chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
  check: <><path d="m5 12 4 4L19 6" /></>,
  'chevron-down': <><path d="m6 9 6 6 6-6" /></>,
  'chevrons-left': <><path d="m11 7-5 5 5 5M17 7l-5 5 5 5" /></>,
  'chevrons-right': <><path d="m7 7 5 5-5 5M13 7l5 5-5 5" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>,
  edit: <><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" /><path d="m13.5 6.5 4 4" /></>,
  folder: <><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" /></>,
  'folder-plus': <><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" /><path d="M12 10v6M9 13h6" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>,
  'import-export': <><path d="M8 3v12M4 11l4 4 4-4M16 21V9M12 13l4-4 4 4" /></>,
  key: <><circle cx="8" cy="15" r="4" /><path d="m11 12 8-8M15 8l3 3M17 6l2 2" /></>,
  layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5M3 16l9 5 9-5" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  route: <><circle cx="6" cy="6" r="2" /><circle cx="18" cy="6" r="2" /><circle cx="12" cy="18" r="2" /><path d="M6 8v3a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8M12 13v3" /></>,
  shield: <><path d="M12 3 4.5 6v5.5c0 4.6 3.2 7.9 7.5 9.5 4.3-1.6 7.5-4.9 7.5-9.5V6L12 3Z" /><path d="m9 12 2 2 4-5" /></>,
  spark: <><path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Z" /><path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z" /></>,
  template: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 9v12" /></>,
  terminal: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="m7 9 3 3-3 3M13 15h4" /></>,
  trash: <><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5" /></>,
  x: <><path d="m6 6 12 12M18 6 6 18" /></>,
}

export function Icon({ name, size = 18, className = '', strokeWidth = 1.8 }: IconProps) {
  return (
    <svg
      className={`icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}

export function BrandMark({ size = 42 }: { size?: number }) {
  return (
    <span className="brand-mark" style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 48 48" fill="none">
        <path d="M12 34V14l12 10 12-10v20" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="14" r="2.5" fill="currentColor" />
        <circle cx="24" cy="24" r="2.5" fill="currentColor" />
        <circle cx="36" cy="14" r="2.5" fill="currentColor" />
      </svg>
    </span>
  )
}
