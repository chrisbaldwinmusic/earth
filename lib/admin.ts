function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export function isAdminAuthorized(request: Request, adminPassword: string): boolean {
  const provided = request.headers.get('X-Admin-Password')
  if (!provided || !adminPassword) return false
  return timingSafeEqual(provided, adminPassword)
}
