import { NextResponse } from 'next/server';
import { AuthError, getCurrentSession, requireSession } from '@/lib/auth';
import { listFieldObjections, updateFieldObjectionStatus } from '@/lib/fieldObjections';
import type { FieldObjectionStatus } from '@/lib/types';

const mutableStatuses = new Set<FieldObjectionStatus>(['Reviewed', 'Accepted', 'Rejected', 'Resolved']);

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = requireSession(await getCurrentSession());

    if (session.role === 'GUEST') {
      throw new AuthError('Guest users cannot update field objections.', 403);
    }

    const { id } = await context.params;
    const body = (await request.json()) as { status?: FieldObjectionStatus };

    if (!body.status || !mutableStatuses.has(body.status)) {
      return NextResponse.json({ error: 'A valid objection status is required.' }, { status: 400 });
    }

    const existing = (await listFieldObjections()).find((objection) => objection.id === id);

    if (!existing) {
      return NextResponse.json({ error: 'Field objection not found.' }, { status: 404 });
    }

    if (existing.responsibleRole !== session.role) {
      throw new AuthError(`${session.role} cannot update this field objection.`, 403);
    }

    const objection = await updateFieldObjectionStatus(id, body.status);

    if (!objection) {
      return NextResponse.json({ error: 'Field objection not found.' }, { status: 404 });
    }

    return NextResponse.json({ data: objection });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to update field objection:', error);
    return NextResponse.json({ error: 'Internal Server Error updating field objection' }, { status: 500 });
  }
}
