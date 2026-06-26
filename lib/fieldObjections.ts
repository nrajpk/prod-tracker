import 'server-only';

import { randomUUID } from 'crypto';
import { createFieldObjectionPayload, validateFieldObjection, type FieldObjectionInput } from '@/lib/fieldPermissions';
import type { FieldObjection, FieldObjectionResponsibleRole, FieldObjectionStatus, UserRole } from '@/lib/types';

const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_PAT = process.env.AIRTABLE_PAT;
const AIRTABLE_FIELD_OBJECTIONS_TABLE_NAME = process.env.AIRTABLE_FIELD_OBJECTIONS_TABLE_NAME || 'Field Objections';

const fieldNames = {
  id: 'Objection ID',
  vehicleId: 'Vehicle ID',
  fieldKey: 'Field Key',
  fieldLabel: 'Field Label',
  stage: 'Stage / Section',
  currentValue: 'Current Value',
  objectedBy: 'Objected By Role',
  responsibleRole: 'Responsible Role',
  reason: 'Reason',
  suggestedValue: 'Suggested Value',
  comment: 'Comment',
  status: 'Status',
  createdAt: 'Created At',
  updatedAt: 'Updated At',
} as const;

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

export async function listFieldObjections(filters: { vehicleId?: string; fieldKey?: string } = {}) {
  assertAirtableConfigured();

  const records = await fetchFieldObjectionRecords();
  return records
    .map(mapAirtableFieldObjection)
    .filter((objection): objection is FieldObjection => Boolean(objection))
    .filter((objection) => !filters.vehicleId || objection.vehicleId === filters.vehicleId)
    .filter((objection) => !filters.fieldKey || objection.fieldKey === filters.fieldKey);
}

export async function createFieldObjection(input: FieldObjectionInput) {
  assertAirtableConfigured();

  const validationError = validateFieldObjection(input);

  if (validationError) {
    throw new FieldObjectionValidationError(validationError);
  }

  const now = new Date().toISOString();
  const objection: FieldObjection = {
    id: randomUUID(),
    ...createFieldObjectionPayload(input),
    status: 'Open',
    createdAt: now,
    updatedAt: now,
  };

  const response = await fetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_FIELD_OBJECTIONS_TABLE_NAME)}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${AIRTABLE_PAT}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        typecast: true,
        fields: toAirtableFields(objection),
      }),
    },
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Airtable field objection create failed: ${response.status} ${errorBody}`);
  }

  return objection;
}

export async function updateFieldObjectionStatus(id: string, status: FieldObjectionStatus) {
  assertAirtableConfigured();

  const records = await fetchFieldObjectionRecords();
  const record = records.find((item) => asString(item.fields[fieldNames.id]) === id || item.id === id);

  if (!record) {
    return null;
  }

  const now = new Date().toISOString();
  const response = await fetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_FIELD_OBJECTIONS_TABLE_NAME)}/${record.id}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${AIRTABLE_PAT}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        typecast: true,
        fields: {
          [fieldNames.status]: status,
          [fieldNames.updatedAt]: now,
        },
      }),
    },
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Airtable field objection update failed: ${response.status} ${errorBody}`);
  }

  const body = (await response.json()) as AirtableRecord;
  return mapAirtableFieldObjection(body);
}

export class FieldObjectionValidationError extends Error {
  constructor(message: string) {
    super(message);
  }
}

function assertAirtableConfigured() {
  if (!AIRTABLE_BASE_ID || !AIRTABLE_PAT) {
    throw new Error('Airtable is not configured. Set AIRTABLE_BASE_ID and AIRTABLE_PAT.');
  }
}

async function fetchFieldObjectionRecords() {
  const records: AirtableRecord[] = [];
  let offset: string | undefined;

  do {
    const url = new URL(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_FIELD_OBJECTIONS_TABLE_NAME)}`,
    );
    url.searchParams.set('pageSize', '100');

    if (offset) {
      url.searchParams.set('offset', offset);
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${AIRTABLE_PAT}`,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Airtable field objection list failed: ${response.status} ${errorBody}`);
    }

    const body = (await response.json()) as { records?: AirtableRecord[]; offset?: string };
    records.push(...(body.records || []));
    offset = body.offset;
  } while (offset);

  return records;
}

function toAirtableFields(objection: FieldObjection) {
  return {
    [fieldNames.id]: objection.id,
    [fieldNames.vehicleId]: objection.vehicleId,
    [fieldNames.fieldKey]: objection.fieldKey,
    [fieldNames.fieldLabel]: objection.fieldLabel,
    [fieldNames.stage]: objection.stage,
    [fieldNames.currentValue]: objection.currentValue,
    [fieldNames.objectedBy]: objection.objectedBy,
    [fieldNames.responsibleRole]: objection.responsibleRole,
    [fieldNames.reason]: objection.reason,
    [fieldNames.suggestedValue]: objection.suggestedValue,
    [fieldNames.comment]: objection.comment,
    [fieldNames.status]: objection.status,
    [fieldNames.createdAt]: objection.createdAt,
    [fieldNames.updatedAt]: objection.updatedAt,
  };
}

function mapAirtableFieldObjection(record: AirtableRecord): FieldObjection | null {
  const fields = record.fields;
  const vehicleId = asString(fields[fieldNames.vehicleId]);
  const fieldKey = asString(fields[fieldNames.fieldKey]);
  const reason = asString(fields[fieldNames.reason]);
  const suggestedValue = asString(fields[fieldNames.suggestedValue]);

  if (!vehicleId || !fieldKey || !reason || !suggestedValue) {
    return null;
  }

  return {
    id: asString(fields[fieldNames.id]) || record.id,
    vehicleId,
    fieldKey,
    fieldLabel: asString(fields[fieldNames.fieldLabel]) || fieldKey,
    stage: asString(fields[fieldNames.stage]),
    currentValue: asString(fields[fieldNames.currentValue]),
    objectedBy: asRole(fields[fieldNames.objectedBy]),
    responsibleRole: asResponsibleRole(fields[fieldNames.responsibleRole]),
    reason,
    suggestedValue,
    comment: asString(fields[fieldNames.comment]) || undefined,
    status: asStatus(fields[fieldNames.status]),
    createdAt: asString(fields[fieldNames.createdAt]),
    updatedAt: asString(fields[fieldNames.updatedAt]),
  } satisfies FieldObjection;
}

function asString(value: unknown) {
  if (value === undefined || value === null) {
    return '';
  }

  if (typeof value === 'object' && 'name' in value && typeof value.name === 'string') {
    return value.name;
  }

  return String(value);
}

function asRole(value: unknown): UserRole {
  const role = asString(value);
  return role === 'MEVA' || role === 'ALPINE' ? role : 'GUEST';
}

function asResponsibleRole(value: unknown): FieldObjectionResponsibleRole {
  const role = asString(value);
  return role === 'MEVA' || role === 'ALPINE' || role === 'SHARED' ? role : 'SHARED';
}

function asStatus(value: unknown): FieldObjectionStatus {
  const status = asString(value);

  if (
    status === 'Open' ||
    status === 'Reviewed' ||
    status === 'Accepted' ||
    status === 'Rejected' ||
    status === 'Resolved'
  ) {
    return status;
  }

  return 'Open';
}
