import { NextResponse } from 'next/server'

export function GET() {
  return NextResponse.json({
    ok: true,
    service: 'jlmcollective',
    checked_at: new Date().toISOString(),
  })
}
