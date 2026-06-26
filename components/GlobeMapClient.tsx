'use client'

import dynamic from 'next/dynamic'

const GlobeMap = dynamic(() => import('@/components/GlobeMap'), { ssr: false })

export default function GlobeMapClient() {
  return <GlobeMap />
}
