import { Suspense } from 'react'
import HomeClient from '@/components/HomeClient'
import { getModelIds } from '@/lib/modelsConfig'

export default function Page() {
  return (
    <Suspense fallback={null}>
      <HomeClient models={getModelIds()} />
    </Suspense>
  )
}
