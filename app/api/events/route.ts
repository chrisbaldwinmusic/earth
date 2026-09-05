import { getDb, rowToMapEvent, type EventRow } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const db = getDb()
  const { results } = await db
    .prepare("SELECT * FROM events WHERE status = 'approved' ORDER BY date ASC")
    .all<EventRow>()
  return Response.json(results.map(rowToMapEvent))
}
