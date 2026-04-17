interface TagProps {
  color: 'amber' | 'green' | 'red' | 'blue'
  children: React.ReactNode
}

function Tag({ color, children }: TagProps) {
  return (
    <span className={`tag tag-${color}`}>
      {children}
    </span>
  )
}

export default Tag
