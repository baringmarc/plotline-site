/** The player view's hook (T6.4): follows one live stack by its code, and stops when the page leaves or the code changes. */
import { useEffect, useState } from 'react'
import { createLiveViewer, type ViewerState } from './viewer'

export function useLiveViewer(code: string): ViewerState {
  const [state, setState] = useState<ViewerState>({ kind: 'loading' })
  useEffect(() => {
    const viewer = createLiveViewer({ code, onState: setState })
    return () => viewer.stop()
  }, [code])
  return state
}
