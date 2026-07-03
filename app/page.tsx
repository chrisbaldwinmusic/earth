import GlobeMapClient from '@/components/GlobeMapClient'
import SitePinGate from '@/components/SitePinGate'

export default function Home() {
  return (
    <main style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <SitePinGate>
        <GlobeMapClient />
      </SitePinGate>
    </main>
  )
}
