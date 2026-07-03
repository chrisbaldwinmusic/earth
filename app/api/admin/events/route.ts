import { getDb, getEnv, rowToMapEvent, type EventRow } from '@/lib/db'
import { isAdminAuthorized } from '@/lib/admin'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!isAdminAuthorized(request, getEnv().ADMIN_PASSWORD)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getDb()
  const { results } = await db
    .prepare("SELECT * FROM events ORDER BY (status = 'pending') DESC, date ASC")
    .all<EventRow>()
  return Response.json(results.map(rowToMapEvent))
}
