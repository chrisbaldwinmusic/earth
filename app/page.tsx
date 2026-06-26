'use client'

import dynamic from 'next/dynamic'

const GlobeMap = dynamic(() => import('@/components/GlobeMap'), { ssr: false })

export default function Home() {
  return (
    <main style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <GlobeMap />
    </main>
  )
}
