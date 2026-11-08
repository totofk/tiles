import { useEffect, useState } from 'react'

/** how long the armed "Press again" state waits for the second press */
export const ARM_MS = 5000

/** two-press confirm (Reset, Import save): the first press arms, the second within ARM_MS confirms; Esc or the timeout disarms */
export function useTwoPress(confirm: () => void): [armed: boolean, press: () => void] {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const id = window.setTimeout(() => setArmed(false), ARM_MS)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setArmed(false)
    }
    document.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(id)
      document.removeEventListener('keydown', onKey)
    }
  }, [armed])
  const press = () => {
    if (!armed) return setArmed(true)
    setArmed(false)
    confirm()
  }
  return [armed, press]
}

/** 📊 Stats "Danger zone": Reset save behind the two-press confirm */
export function DangerZone({ reset }: { reset: () => void }) {
  const [armed, press] = useTwoPress(reset)
  return (
    <section className="shop danger">
      <h2>Danger zone</h2>
      <button className={armed ? 'reset armed' : 'reset'} onClick={press}>
        {armed ? 'Press again to erase everything' : 'Reset save'}
      </button>
    </section>
  )
}
