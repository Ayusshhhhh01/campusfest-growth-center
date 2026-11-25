import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: activationId } = await context.params;
    const body = (await request.json()) as { plan_approved: boolean };
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('sponsor_activations')
      .update({ plan_approved: Boolean(body.plan_approved) })
      .eq('activation_id', activationId)
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed updating activation: ${error.message}`);
    }
    return NextResponse.json({ ok: true, activation: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed updating activation';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
