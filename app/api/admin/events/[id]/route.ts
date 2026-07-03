import { getDb, getEnv } from '@/lib/db'
import { isAdminAuthorized } from '@/lib/admin'

export const dynamic = 'force-dynamic'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdminAuthorized(request, getEnv().ADMIN_PASSWORD)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const db = getDb()
  const result = await db
    .prepare("UPDATE events SET status = 'approved' WHERE id = ? AND status = 'pending'")
    .bind(id)
    .run()

  if (result.meta.changes === 0) {
    return Response.json({ error: 'Not found or already approved' }, { status: 404 })
  }
  return new Response(null, { status: 204 })
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdminAuthorized(request, getEnv().ADMIN_PASSWORD)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const db = getDb()
  await db.prepare('DELETE FROM events WHERE id = ?').bind(id).run()
  return new Response(null, { status: 204 })
}
