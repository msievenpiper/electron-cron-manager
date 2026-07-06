import { useEffect, useState } from 'react'
import Layout from './components/Layout'
import OnboardingFlow from './pages/OnboardingFlow'

export default function App() {
  const [hasOnboarded, setHasOnboarded] = useState<boolean | null>(null)

  useEffect(() => {
    window.cronManager.settings.get('has_onboarded').then((value) => setHasOnboarded(value === '1'))
  }, [])

  if (hasOnboarded === null) return null
  if (!hasOnboarded) return <OnboardingFlow onComplete={() => setHasOnboarded(true)} />
  return <Layout />
}
