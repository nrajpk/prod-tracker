import { NextResponse } from 'next/server';
import { AuthError, getCurrentSession, requireSession } from '@/lib/auth';
import { STAGE_ORDER } from '@/lib/vehicleTimeline';
import type { ProductionStatus } from '@/lib/types';

const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_PAT = process.env.AIRTABLE_PAT;
const AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE_NAME || 'Vehicles';

const updatableFields = {
  productionStatus: 'Production_Status',
  expectedCompletionDate: 'Expected_Completion_Date',
  actualCompletionDate: 'Actual_Completion_Date',
  notes: 'Schedule_Variance_Notes',
  mevaNotes: 'Internal_Notes',
} as const;

type UpdateKey = keyof typeof updatableFields;

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = requireSession(await getCurrentSession());

    if (session.role !== 'MEVA') {
      throw new AuthError('Only MEVA can update production records.', 403);
    }

    if (!AIRTABLE_BASE_ID || !AIRTABLE_PAT) {
      return NextResponse.json(
        { error: 'Airtable is not configured. Set AIRTABLE_BASE_ID and AIRTABLE_PAT.' },
        { status: 500 },
      );
    }

    const { id } = await context.params;
    const body = (await request.json()) as Partial<Record<UpdateKey, string>>;
    const fields: Record<string, string | null> = {};

    for (const [clientKey, airtableField] of Object.entries(updatableFields) as [UpdateKey, string][]) {
      if (Object.prototype.hasOwnProperty.call(body, clientKey)) {
        const value = body[clientKey];

        if (
          clientKey === 'productionStatus' &&
          value &&
          !STAGE_ORDER.includes(value as ProductionStatus)
        ) {
          return NextResponse.json({ error: 'Invalid production stage.' }, { status: 400 });
        }

        fields[airtableField] = value === undefined || value === '' ? null : value;
      }
    }

    if (Object.keys(fields).length === 0) {
      return NextResponse.json({ error: 'No permitted fields were provided.' }, { status: 400 });
    }

    const response = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}/${id}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${AIRTABLE_PAT}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fields }),
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Airtable update failed: ${response.status} ${errorBody}`);
    }

    return NextResponse.json({
      ok: true,
      updatedBy: session.username,
      updatedFields: Object.keys(fields),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to update production vehicle:', error);
    return NextResponse.json({ error: 'Internal Server Error updating production record' }, { status: 500 });
  }
}
