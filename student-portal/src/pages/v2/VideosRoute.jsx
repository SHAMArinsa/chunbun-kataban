import { Navigate } from 'react-router-dom'
import Spinner from '../../components/ui/Spinner'
import { useV2Overview } from '../../lib/v2'
import Materials from '../Materials'

/* Videos are a Career Accelerator feature; other tiers are sent back to Study Materials. */
export default function VideosRoute() {
  const { data, isLoading } = useV2Overview()
  if (isLoading) return <Spinner />
  if (data?.program?.tier !== 'accelerator') return <Navigate to="/materials" replace />
  return <Materials mode="videos" />
}

/* Career Accelerator has no Study Materials — only Videos. */
export function MaterialsRoute() {
  const { data, isLoading } = useV2Overview()
  if (isLoading) return <Spinner />
  if (data?.program?.tier === 'accelerator') return <Navigate to="/videos" replace />
  return <Materials />
}
