import { useEffect, useState } from 'react'

const QUERY = '(max-width: 899px)'

// True below 900px wide. Treated as wide where matchMedia does not exist.
export function useNarrow() {
  const [narrow, setNarrow] = useState(() => window.matchMedia?.(QUERY).matches ?? false)
  useEffect(() => {
    const media = window.matchMedia?.(QUERY)
    if (!media) return
    const update = () => setNarrow(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  return narrow
}
