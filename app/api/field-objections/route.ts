import { NextResponse } from 'next/server';
import { AuthError, getCurrentSession, getPermissions, requireSession } from '@/lib/auth';
import {
  FieldObjectionValidationError,
  createFieldObjection,
  listFieldObjections,
} from '@/lib/fieldObjections';

export async function GET(request: Request) {
  try {
    const session = requireSession(await getCurrentSession());
    const permissions = getPermissions(session.role);

    if (!permissions.canViewDisputes) {
      return NextResponse.json({ data: [] });
    }

    const url = new URL(request.url);

    return NextResponse.json({
      data: await listFieldObjections({
        vehicleId: url.searchParams.get('vehicleId') || undefined,
        fieldKey: url.searchParams.get('fieldKey') || undefined,
      }),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to load field objections:', error);
    return NextResponse.json({ error: 'Internal Server Error loading field objections' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = requireSession(await getCurrentSession());

    if (session.role === 'GUEST') {
      throw new AuthError('Guest users cannot create field objections.', 403);
    }

    const body = (await request.json()) as {
      vehicleId?: string;
      fieldKey?: string;
      currentValue?: unknown;
      reason?: string;
      suggestedValue?: string;
      comment?: string;
    };

    const objection = await createFieldObjection({
      vehicleId: body.vehicleId,
      fieldKey: body.fieldKey,
      currentValue: body.currentValue,
      objectedBy: session.role,
      reason: body.reason,
      suggestedValue: body.suggestedValue,
      comment: body.comment,
    });

    return NextResponse.json({ data: objection }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof FieldObjectionValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error('Failed to create field objection:', error);
    return NextResponse.json({ error: 'Internal Server Error creating field objection' }, { status: 500 });
  }
}
