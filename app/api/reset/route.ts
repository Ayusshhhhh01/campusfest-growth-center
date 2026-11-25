import { NextResponse } from 'next/server';
import { resetAndSeedDatabase } from '@/lib/seed';

export async function POST() {
  try {
    const summary = await resetAndSeedDatabase();
    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown reset error';
    console.error('[POST /api/reset] Error:', message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
