// Best-effort in-memory per-IP rate limiter for public endpoints that spend
// money (AI, maps, email). It blunts a naive flood without any extra
// infrastructure. NOTE: state is per serverless instance, so it is not a global
// guarantee — a Redis/Upstash-backed limiter is the production-grade upgrade if
// abuse ever becomes real. Invisible to normal users at the limits below.

const buckets = new Map<string, { count: number; resetAt: number }>()

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown'
  return request.headers.get('x-real-ip') || 'unknown'
}

// Returns true if the request is allowed, false if it should be rejected (429).
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()

  // Opportunistic cleanup so the map can't grow without bound.
  if (buckets.size > 5000) {
    for (const [existingKey, value] of buckets) {
      if (value.resetAt < now) buckets.delete(existingKey)
    }
  }

  const entry = buckets.get(key)
  if (!entry || entry.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (entry.count >= limit) return false
  entry.count += 1
  return true
}
