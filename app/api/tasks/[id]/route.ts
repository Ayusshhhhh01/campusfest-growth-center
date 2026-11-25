import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await context.params;
    const body = (await request.json()) as {
      title?: string;
      description?: string | null;
      owner_name?: string;
      status?: 'todo' | 'in_progress' | 'done';
      priority?: 'high' | 'medium' | 'low';
      due_date?: string | null;
      linked_brand_id?: string | null;
      linked_opportunity_id?: string | null;
    };

    const updates: Record<string, unknown> = {};
    if (body.title !== undefined) updates.title = body.title.trim();
    if (body.description !== undefined) updates.description = body.description?.trim() || null;
    if (body.owner_name !== undefined) updates.owner_name = body.owner_name.trim();
    if (body.status !== undefined) updates.status = body.status;
    if (body.priority !== undefined) updates.priority = body.priority;
    if (body.due_date !== undefined) updates.due_date = body.due_date?.trim() || null;
    if (body.linked_brand_id !== undefined) updates.linked_brand_id = body.linked_brand_id || null;
    if (body.linked_opportunity_id !== undefined)
      updates.linked_opportunity_id = body.linked_opportunity_id || null;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('growth_tasks')
      .update(updates)
      .eq('task_id', taskId)
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed updating task: ${error.message}`);
    }

    return NextResponse.json({ ok: true, task: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed updating task';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await context.params;
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('growth_tasks').delete().eq('task_id', taskId);
    if (error) {
      throw new Error(`Failed deleting task: ${error.message}`);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed deleting task';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
