import { connection, NextRequest, NextResponse } from 'next/server';
import { listTasks } from '@/lib/metrics';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  await connection();
  try {
    const status = request.nextUrl.searchParams.get('status') ?? undefined;
    const tasks = await listTasks(status);
    return NextResponse.json({ tasks });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed listing tasks';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      title: string;
      description?: string | null;
      owner_name: string;
      status?: 'todo' | 'in_progress' | 'done';
      priority?: 'high' | 'medium' | 'low';
      due_date?: string | null;
      linked_brand_id?: string | null;
      linked_opportunity_id?: string | null;
      source?: 'manual' | 'copilot';
    };

    if (!body.title?.trim()) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }
    if (!body.owner_name?.trim()) {
      return NextResponse.json({ error: 'owner_name is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('growth_tasks')
      .insert({
        title: body.title.trim(),
        description: body.description?.trim() || null,
        owner_name: body.owner_name.trim(),
        status: body.status ?? 'todo',
        priority: body.priority ?? 'medium',
        due_date: body.due_date?.trim() || null,
        linked_brand_id: body.linked_brand_id?.trim() || null,
        linked_opportunity_id: body.linked_opportunity_id?.trim() || null,
        source: body.source ?? 'manual',
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed creating task: ${error.message}`);
    }

    return NextResponse.json({ ok: true, task: data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed creating task';
    console.error('[POST /api/tasks] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
