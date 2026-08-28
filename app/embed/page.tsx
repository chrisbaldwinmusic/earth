import GlobeMapClient from '@/components/GlobeMapClient'

export default function EmbedPage() {
  return (
    <main style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <GlobeMapClient readOnly />
    </main>
  )
}
