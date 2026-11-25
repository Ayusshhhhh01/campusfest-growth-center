import { connection, NextRequest, NextResponse } from 'next/server';
import { DEFAULT_AS_OF_DATE, getFullDashboardPayload } from '@/lib/metrics';

export async function GET(request: NextRequest) {
  await connection();
  try {
    const asOfDate = request.nextUrl.searchParams.get('as_of_date') ?? DEFAULT_AS_OF_DATE;
    const payload = await getFullDashboardPayload(asOfDate);
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load dashboard data';
    console.error('[GET /api/dashboard] Error:', message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
