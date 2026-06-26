import { NextResponse } from 'next/server';
import { AuthError, getCurrentSession, getPermissions, requireSession } from '@/lib/auth';
import { updateDispute } from '@/lib/disputes';
import type { DisputeStatus } from '@/lib/types';

const alpineStatuses = new Set<DisputeStatus>(['Alpine Accepted', 'Escalated']);
const mevaStatuses = new Set<DisputeStatus>(['MEVA Reviewing', 'MEVA Responded', 'Resolved']);

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = requireSession(await getCurrentSession());
    const permissions = getPermissions(session.role);
    const { id } = await context.params;
    const body = (await request.json()) as {
      status?: DisputeStatus;
      mevaResponse?: string;
    };

    if (session.role === 'MEVA') {
      if (!permissions.canRespondToDisputes) {
        throw new AuthError('MEVA dispute response permission is required.', 403);
      }

      if (body.status && !mevaStatuses.has(body.status)) {
        throw new AuthError('MEVA cannot set that dispute status.', 403);
      }
    } else if (session.role === 'ALPINE') {
      if (body.mevaResponse) {
        throw new AuthError('Alpine cannot edit MEVA response fields.', 403);
      }

      if (!body.status || !alpineStatuses.has(body.status)) {
        throw new AuthError('Alpine can only accept or escalate a responded dispute.', 403);
      }
    } else {
      throw new AuthError('Guest users cannot update disputes.', 403);
    }

    const dispute = await updateDispute(id, {
      status: body.status,
      mevaResponse: body.mevaResponse,
    });

    if (!dispute) {
      return NextResponse.json({ error: 'Dispute not found.' }, { status: 404 });
    }

    return NextResponse.json({ data: dispute });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to update dispute:', error);
    return NextResponse.json({ error: 'Internal Server Error updating dispute' }, { status: 500 });
  }
}
