import { NextResponse } from 'next/server';
import { AuthError, getCurrentSession, getPermissions, requireSession } from '@/lib/auth';
import { createDispute, listDisputes } from '@/lib/disputes';

export async function GET() {
  try {
    const session = requireSession(await getCurrentSession());
    const permissions = getPermissions(session.role);

    if (!permissions.canViewDisputes) {
      return NextResponse.json({ data: [] });
    }

    return NextResponse.json({ data: await listDisputes() });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to load disputes:', error);
    return NextResponse.json({ error: 'Internal Server Error loading disputes' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = requireSession(await getCurrentSession());
    const permissions = getPermissions(session.role);

    if (!permissions.canOpenDisputes) {
      throw new AuthError('Only Alpine can open disputes.', 403);
    }

    const body = (await request.json()) as {
      vehicleId?: string;
      vehicleNumber?: string;
      disputeType?: string;
      disputedField?: string;
      alpineClaim?: string;
    };

    if (!body.vehicleId || !body.vehicleNumber || !body.disputedField || !body.alpineClaim) {
      return NextResponse.json({ error: 'Vehicle, field, and claim are required.' }, { status: 400 });
    }

    const dispute = await createDispute({
      vehicleId: body.vehicleId,
      vehicleNumber: body.vehicleNumber,
      disputeType: body.disputeType || 'Production record dispute',
      disputedField: body.disputedField,
      alpineClaim: body.alpineClaim,
      openedBy: session.username,
      openedByRole: session.role,
      openedByOrg: session.organization,
    });

    return NextResponse.json({ data: dispute }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to create dispute:', error);
    return NextResponse.json({ error: 'Internal Server Error creating dispute' }, { status: 500 });
  }
}
