/**
 * Dead-man's switch for scheduled jobs.
 *
 * A cron that silently stops running is invisible: Vercel drops the schedule, a
 * deploy breaks the route, the function starts erroring — and no one notices
 * until a guest complains they never got a balance reminder. The fix is an
 * external heartbeat: the job pings a monitor every time it finishes, and the
 * monitor alerts YOU when the ping stops arriving.
 *
 * Usage: call `pingCronHeartbeat('<job-slug>')` right before a successful return,
 * and `pingCronHeartbeat('<job-slug>', false)` on a handled failure so the
 * monitor alerts immediately instead of waiting for the grace period.
 *
 * It's a no-op until CRON_HEARTBEAT_URL is set, so it's safe to ship before you
 * have a monitor. To enable it:
 *   1. Create a check at healthchecks.io (free) or BetterStack "heartbeat".
 *   2. Copy its ping URL.
 *   3. Set CRON_HEARTBEAT_URL in Vercel. If you have more than one job, use a
 *      slug-templated URL and put {slug} where the per-check id goes, e.g.
 *      healthchecks.io slug pings:  https://hc-ping.com/<ping-key>/{slug}
 *      Without {slug}, the same URL is pinged for every job.
 */
export async function pingCronHeartbeat(slug: string, ok = true): Promise<void> {
  const base = process.env.CRON_HEARTBEAT_URL
  if (!base) return

  let url = base.includes('{slug}')
    ? base.replace('{slug}', encodeURIComponent(slug))
    : base
  // healthchecks.io convention: a trailing /fail signals a failed run.
  if (!ok) url = `${url.replace(/\/+$/, '')}/fail`

  try {
    await fetch(url, {
      method: 'POST',
      cache: 'no-store',
      // A slow monitor must never hold up (or fail) the job it's watching.
      signal: AbortSignal.timeout(5000),
    })
  } catch {
    // Monitoring is best-effort; swallow everything so it can't break the job.
  }
}
