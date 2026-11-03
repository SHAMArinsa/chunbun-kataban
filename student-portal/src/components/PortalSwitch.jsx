import Spinner from './ui/Spinner'
import { useV2Status } from '../lib/v2'

/** Renders the Portal V2 page for students in the five new programs, otherwise the legacy page. */
export default function PortalSwitch({ v2, legacy }) {
  const { data, isLoading } = useV2Status()
  if (isLoading) return <Spinner />
  return data?.portal === 'v2' ? v2 : legacy
}
