import { NextResponse } from 'next/server';
import { AuthError, getCurrentSession, requireSession } from '@/lib/auth';
import { canEditField, getFieldLabel, isCalculatedField } from '@/lib/fieldPermissions';
import { STAGE_ORDER } from '@/lib/vehicleTimeline';
import type { ProductionStatus } from '@/lib/types';

const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_PAT = process.env.AIRTABLE_PAT;
const AIRTABLE_VEHICLES_TABLE =
  process.env.AIRTABLE_VEHICLES_TABLE_ID || process.env.AIRTABLE_TABLE_NAME || 'tblnUSpFuIpWsehRr';
const AIRTABLE_LOGISTICS_TABLE =
  process.env.AIRTABLE_LOGISTICS_TABLE_ID || process.env.AIRTABLE_LOGISTICS_TABLE_NAME || 'tblZYcmVkUrxDA3hm';
const AIRTABLE_FINANCIALS_TABLE =
  process.env.AIRTABLE_FINANCIALS_TABLE_ID || process.env.AIRTABLE_FINANCIALS_TABLE_NAME || 'tbllMmnnaxYaeMCZZ';

const updatableFields = {
  vehicleNumber: { table: 'vehicles', field: 'Vehicle_ID' },
  designStyle: { table: 'vehicles', field: 'Design_Style' },
  modelYear: { table: 'vehicles', field: 'Model_Year' },
  vin: { table: 'vehicles', field: 'VIN' },
  armoringLevel: { table: 'vehicles', field: 'Armoring_Level' },
  facility: { table: 'vehicles', field: 'Facility' },
  productionStatus: { table: 'vehicles', field: 'Production_Status' },
  expectedCompletionDate: { table: 'vehicles', field: 'Expected_Completion_Date' },
  actualCompletionDate: { table: 'vehicles', field: 'Actual_Completion_Date' },
  notes: { table: 'vehicles', field: 'Schedule_Variance_Notes' },
  mevaNotes: { table: 'vehicles', field: 'Internal_Notes' },
  chassisShippedFromAlpineDate: { table: 'logistics', field: 'Chassis_Shipped_From_Alpine' },
  chassisArrivalExpectedDate: { table: 'logistics', field: 'Chassis_Arrival_At_MEVA' },
  shippedFromMevaDate: { table: 'logistics', field: 'Completed_Vehicle_Shipped_From_MEVA' },
  currentStatus: { table: 'logistics', field: 'Transit_Location_Notes' },
  basePriceUsd: { table: 'financials', field: 'Base_Price_USD' },
  conditionalPriceUsd: { table: 'financials', field: 'Conditional_Price_USD' },
  conditionalDeadline: { table: 'financials', field: 'Conditional_Deadline' },
  paymentNotes: { table: 'financials', field: 'Payment_Notes' },
} as const;

type UpdateKey = keyof typeof updatableFields;
type AirtableTableKey = (typeof updatableFields)[UpdateKey]['table'];

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = requireSession(await getCurrentSession());

    if (!AIRTABLE_BASE_ID || !AIRTABLE_PAT) {
      return NextResponse.json(
        { error: 'Airtable is not configured. Set AIRTABLE_BASE_ID and AIRTABLE_PAT.' },
        { status: 500 },
      );
    }

    const { id } = await context.params;
    const body = (await request.json()) as Partial<Record<UpdateKey, string>>;
    const fieldsByTable: Record<AirtableTableKey, Record<string, string | null>> = {
      vehicles: {},
      logistics: {},
      financials: {},
    };
    const updatedClientFields: string[] = [];
    const unknownKeys = Object.keys(body).filter((key) => !(key in updatableFields));

    if (unknownKeys.length > 0) {
      const calculatedKey = unknownKeys.find((key) => isCalculatedField(key));

      if (calculatedKey) {
        throw new AuthError(`${getFieldLabel(calculatedKey)} is calculated and cannot be edited.`, 403);
      }

      throw new AuthError(`Updates are not configured for: ${unknownKeys.join(', ')}.`, 403);
    }

    for (const [clientKey, config] of Object.entries(updatableFields) as [
      UpdateKey,
      (typeof updatableFields)[UpdateKey],
    ][]) {
      if (Object.prototype.hasOwnProperty.call(body, clientKey)) {
        if (isCalculatedField(clientKey)) {
          throw new AuthError(`${getFieldLabel(clientKey)} is calculated and cannot be edited.`, 403);
        }

        if (!canEditField(session.role, clientKey)) {
          throw new AuthError(`${session.role} cannot edit ${getFieldLabel(clientKey)}.`, 403);
        }

        const value = body[clientKey];

        if (
          clientKey === 'productionStatus' &&
          value &&
          !STAGE_ORDER.includes(value as ProductionStatus)
        ) {
          return NextResponse.json({ error: 'Invalid production stage.' }, { status: 400 });
        }

        fieldsByTable[config.table][config.field] = value === undefined || value === '' ? null : value;
        updatedClientFields.push(clientKey);
      }
    }

    if (updatedClientFields.length === 0) {
      return NextResponse.json({ error: 'No permitted fields were provided.' }, { status: 400 });
    }

    const vehicleRecord = await fetchAirtableRecord(AIRTABLE_VEHICLES_TABLE, id);
    const currentVehicleId = readVehicleId(vehicleRecord.fields);
    const nextVehicleId = String(body.vehicleNumber || currentVehicleId || '').trim();

    if (!currentVehicleId && !nextVehicleId) {
      return NextResponse.json({ error: 'Vehicle_ID is required to update related Airtable tables.' }, { status: 400 });
    }

    await updateTableFields(AIRTABLE_VEHICLES_TABLE, id, fieldsByTable.vehicles);

    if (Object.keys(fieldsByTable.logistics).length > 0) {
      await upsertRelatedVehicleRecord(AIRTABLE_LOGISTICS_TABLE, currentVehicleId || nextVehicleId, nextVehicleId, fieldsByTable.logistics);
    } else if (body.vehicleNumber) {
      await renameRelatedVehicleRecord(AIRTABLE_LOGISTICS_TABLE, currentVehicleId, nextVehicleId);
    }

    if (Object.keys(fieldsByTable.financials).length > 0) {
      await upsertRelatedVehicleRecord(AIRTABLE_FINANCIALS_TABLE, currentVehicleId || nextVehicleId, nextVehicleId, fieldsByTable.financials);
    } else if (body.vehicleNumber) {
      await renameRelatedVehicleRecord(AIRTABLE_FINANCIALS_TABLE, currentVehicleId, nextVehicleId);
    }

    return NextResponse.json({
      ok: true,
      updatedBy: session.username,
      updatedFields: updatedClientFields,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to update production vehicle:', error);
    return NextResponse.json({ error: 'Internal Server Error updating production record' }, { status: 500 });
  }
}

async function fetchAirtableRecord(table: string, recordId: string) {
  const response = await fetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(table)}/${recordId}`,
    {
      headers: {
        Authorization: `Bearer ${AIRTABLE_PAT}`,
        'Content-Type': 'application/json',
      },
    },
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Airtable fetch failed: ${response.status} ${errorBody}`);
  }

  return (await response.json()) as { id: string; fields: Record<string, unknown> };
}

async function updateTableFields(table: string, recordId: string, fields: Record<string, string | null>) {
  if (Object.keys(fields).length === 0) {
    return;
  }

  const response = await fetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(table)}/${recordId}`,
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
}

async function upsertRelatedVehicleRecord(
  table: string,
  currentVehicleId: string,
  nextVehicleId: string,
  fields: Record<string, string | null>,
) {
  const record = await findRelatedVehicleRecord(table, currentVehicleId);
  const relatedFields = {
    Vehicle_ID: nextVehicleId,
    ...fields,
  };

  if (record) {
    await updateTableFields(table, record.id, relatedFields);
    return;
  }

  await createRelatedVehicleRecord(table, relatedFields);
}

async function renameRelatedVehicleRecord(table: string, currentVehicleId: string, nextVehicleId: string) {
  if (!currentVehicleId || currentVehicleId === nextVehicleId) {
    return;
  }

  const record = await findRelatedVehicleRecord(table, currentVehicleId);

  if (record) {
    await updateTableFields(table, record.id, { Vehicle_ID: nextVehicleId });
  }
}

async function findRelatedVehicleRecord(table: string, vehicleId: string) {
  const records = await fetchRelatedRecords(table);
  return records.find((record) => readVehicleId(record.fields) === vehicleId);
}

async function fetchRelatedRecords(table: string) {
  const records: { id: string; fields: Record<string, unknown> }[] = [];
  let offset: string | undefined;

  do {
    const url = new URL(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(table)}`,
    );

    if (offset) {
      url.searchParams.set('offset', offset);
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${AIRTABLE_PAT}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Airtable lookup failed: ${response.status} ${errorBody}`);
    }

    const data = (await response.json()) as {
      records: { id: string; fields: Record<string, unknown> }[];
      offset?: string;
    };

    records.push(...data.records);
    offset = data.offset;
  } while (offset);

  return records;
}

async function createRelatedVehicleRecord(table: string, fields: Record<string, string | null>) {
  const response = await fetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(table)}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${AIRTABLE_PAT}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields }),
    },
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Airtable create failed: ${response.status} ${errorBody}`);
  }
}

function readVehicleId(fields: Record<string, unknown>) {
  const value = fields.Vehicle_ID || fields['Vehicle #'] || fields['Vehicle ID'];

  if (value === undefined || value === null) {
    return '';
  }

  return String(value).trim();
}
