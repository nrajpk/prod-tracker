import { NextResponse } from 'next/server';
import type {
  OperationalRisk,
  ProductionBlockerStatus,
  ProductionBlockerType,
  ProductionSubStatus,
  ProductionStatus,
  ProductionSummary,
  ProductionVehicle,
  RawAirtableRecord,
} from '@/lib/types';
import { AuthError, getCurrentSession, getPermissions, requireSession } from '@/lib/auth';
import {
  STAGE_ORDER,
  calculateDaysBetween,
  getDashboardBucket,
  getDaysAtMEVA,
  getShippingDaysAlpineToMEVA,
  getShippingDaysMEVAToAlpine,
  isProductionCompleteStatus,
} from '@/lib/vehicleTimeline';

const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_PAT = process.env.AIRTABLE_PAT;
const AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE_NAME || 'Vehicles';

class AirtableError extends Error {
  constructor(
    public status: number,
    public body: string,
  ) {
    super(`Airtable API error: ${status}`);
  }
}

const fieldAliases = {
  vehicleNumber: ['Vehicle #', 'Vehicle_ID', 'Vehicle ID', 'Vehicle Number'],
  vehicle: ['VEHICLE', 'Vehicle', 'Make & Model', 'MAKE & MODEL'],
  designStyle: ['Design Style', 'Design_Style'],
  modelYear: ['Model Year', 'Model_Year', 'Year'],
  vin: ['VIN'],
  armoringLevel: ['Armoring Level', 'Armoring_Level'],
  facility: ['Plant Work done at', ' Plant Work done at', 'Facility'],
  productionStatus: ['Production Status', 'Production Status ', 'Production_Status'],
  productionSubStatus: ['Production Sub Status', 'Production Sub-Status', 'Production_Sub_Status'],
  blockerType: ['Blocker Type', 'Production Blocker Type', 'Production_Blocker_Type'],
  blockerStatus: ['Blocker Status', 'Production Blocker Status', 'Production_Blocker_Status'],
  blockerStartedAt: ['Blocker Started At', 'Blocker Start Date', 'Blocker_Started_At'],
  blockerResolvedAt: ['Blocker Resolved At', 'Blocker Resolved Date', 'Blocker_Resolved_At'],
  blockerDays: ['Blocker Days', 'Production Blocker Days', 'Blocker_Days'],
  chassisShippedFromAlpineDate: [
    'Date chassis was shipped from Alpine',
    'Date shipped from Alpine',
  ],
  chassisArrivalExpectedDate: [
    'Chassis arrival Date at MEVA',
    'Arrival Date at MEVA',
    'Chassis_Arrival_At_MEVA',
  ],
  chassisArrivalActualDate: ['Actual Chassis Arrival Date at MEVA'],
  designChangeRequestedDate: ['Design Change request from Alpine'],
  designChangeCompletedDate: [
    'Design Change completion',
    'Design Change completion time',
    'Design Change completion time ',
  ],
  designApprovedDate: ['Design Approval'],
  actualProductionTime: ['Actual Production Time', 'Actual Production Time '],
  expectedCompletionDate: ['Expected Completion Date', 'Expected_Completion_Date'],
  actualProductionCompletionDate: [
    'Actual Production completion Date',
    'Actual Production completion Date ',
  ],
  actualCompletionDate: ['Actual Completion Date', 'Actual_Completion_Date'],
  shippedFromMevaDate: [
    'Completed Vehicle Shipped from MEVA',
    'Completed_Vehicle_Shipped_From_MEVA',
  ],
  arrivedAtAlpineDate: ['Date Arrived at Alpine'],
  shippingDaysToMeva: ['Shipping days (Alpine to MEVA)'],
  shippingDaysToAlpine: ['Shipping days (MEVA to Alpine)'],
  daysAtMeva: ['# of Days at MEVA'],
  daysMevaTookToFinish: ['# of days took MEVA to finish'],
  scheduleVarianceDays: ['Schedule Variance'],
  mevaNotes: ['MEVA NOTES', 'MEVA_Rebuttal_Notes'],
  notes: ['NOTES', 'NOTE', 'Schedule_Variance_Notes'],
  currentStatus: ['Current Status', 'Transit_Location_Notes'],
  alpineAssessment: [
    "ALPINE'S ASSESSMENT OF THE VEHICLE UPON RECEIPT",
    'Alpine_Claimed_Arrival',
  ],
} as const;

type FieldKey = keyof typeof fieldAliases;

export async function GET() {
  try {
    const session = requireSession(await getCurrentSession());
    const permissions = getPermissions(session.role);

    if (!AIRTABLE_BASE_ID || !AIRTABLE_PAT) {
      return NextResponse.json(
        { error: 'Airtable is not configured. Set AIRTABLE_BASE_ID and AIRTABLE_PAT.' },
        { status: 500 },
      );
    }

    const records = await fetchAirtableRecords();
    const vehicles = records
      .map(mapAirtableVehicle)
      .filter((vehicle): vehicle is ProductionVehicle => Boolean(vehicle))
      .map((vehicle) => sanitizeVehicleForRole(vehicle, permissions.canViewInternalNotes))
      .sort((a, b) => a.vehicleNumber.localeCompare(b.vehicleNumber, undefined, { numeric: true }));

    return NextResponse.json({
      data: vehicles,
      summary: buildSummary(vehicles),
      updatedAt: new Date().toISOString(),
      session,
      permissions,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof AirtableError) {
      console.error('Airtable request failed:', error.status, error.body);
      return NextResponse.json(
        {
          error: 'Airtable request failed.',
          detail: `Airtable returned ${error.status}. Check AIRTABLE_PAT, AIRTABLE_BASE_ID, AIRTABLE_TABLE_NAME, and AIRTABLE_SORT_FIELD in Vercel.`,
        },
        { status: 502 },
      );
    }

    console.error('Failed to fetch MEVA production data:', error);
    return NextResponse.json(
      { error: 'Internal Server Error fetching production data' },
      { status: 500 },
    );
  }
}

function sanitizeVehicleForRole(vehicle: ProductionVehicle, canViewInternalNotes: boolean) {
  if (canViewInternalNotes) {
    return vehicle;
  }

  return {
    ...vehicle,
    mevaNotes: undefined,
  };
}

async function fetchAirtableRecords() {
  const records: RawAirtableRecord[] = [];
  let offset: string | undefined;

  do {
    const url = new URL(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}`,
    );

    if (offset) {
      url.searchParams.set('offset', offset);
    }

    const sortField = process.env.AIRTABLE_SORT_FIELD || 'Vehicle_ID';
    url.searchParams.set('sort[0][field]', sortField);
    url.searchParams.set('sort[0][direction]', 'asc');

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${AIRTABLE_PAT}`,
        'Content-Type': 'application/json',
      },
      next: { revalidate: 60 },
    });

    if (!response.ok) {
      throw new AirtableError(response.status, await response.text());
    }

    const data = (await response.json()) as {
      records: RawAirtableRecord[];
      offset?: string;
    };

    records.push(...data.records);
    offset = data.offset;
  } while (offset);

  return records;
}

function mapAirtableVehicle(record: RawAirtableRecord): ProductionVehicle | null {
  const vehicleNumber = asString(getField(record.fields, 'vehicleNumber'));

  if (!vehicleNumber) {
    return null;
  }

  const productionStatus = normalizeStatus(asString(getField(record.fields, 'productionStatus')));
  const expectedCompletionDate = asDateString(getField(record.fields, 'expectedCompletionDate'));
  const actualCompletionDate = asDateString(getField(record.fields, 'actualCompletionDate'));
  const actualProductionCompletionDate = asDateString(
    getField(record.fields, 'actualProductionCompletionDate'),
  );
  const shippedFromMevaDate = asDateString(getField(record.fields, 'shippedFromMevaDate'));
  const arrivedAtAlpineDate = asDateString(getField(record.fields, 'arrivedAtAlpineDate'));
  const chassisArrivalExpectedDate = asDateString(getField(record.fields, 'chassisArrivalExpectedDate'));
  const chassisArrivalActualDate = asDateString(getField(record.fields, 'chassisArrivalActualDate'));
  const designApprovedDate = asDateString(getField(record.fields, 'designApprovedDate'));

  const completionAnchor =
    actualProductionCompletionDate || actualCompletionDate || shippedFromMevaDate || arrivedAtAlpineDate;
  const arrivalAnchor = chassisArrivalActualDate || chassisArrivalExpectedDate;
  const productionStartAnchor = designApprovedDate || arrivalAnchor;

  const daysMevaTookToFinish =
    asNumber(getField(record.fields, 'daysMevaTookToFinish')) ??
    calculateDaysBetween(productionStartAnchor, completionAnchor);
  const scheduleVarianceDays =
    asNumber(getField(record.fields, 'scheduleVarianceDays')) ??
    calculateScheduleVariance(expectedCompletionDate, completionAnchor, productionStatus);

  const vehicle: ProductionVehicle = {
    id: record.id,
    vehicleNumber,
    vehicle: asString(getField(record.fields, 'vehicle')),
    designStyle: asString(getField(record.fields, 'designStyle')),
    modelYear: asNumber(getField(record.fields, 'modelYear')),
    vin: asString(getField(record.fields, 'vin')),
    armoringLevel: asString(getField(record.fields, 'armoringLevel')),
    facility: asString(getField(record.fields, 'facility')),
    productionStatus,
    productionSubStatus: normalizeProductionSubStatus(asString(getField(record.fields, 'productionSubStatus'))),
    blockerType: normalizeBlockerType(asString(getField(record.fields, 'blockerType'))),
    blockerStatus: normalizeBlockerStatus(asString(getField(record.fields, 'blockerStatus'))),
    blockerStartedAt: asDateString(getField(record.fields, 'blockerStartedAt')),
    blockerResolvedAt: asDateString(getField(record.fields, 'blockerResolvedAt')),
    blockerDays: asNumber(getField(record.fields, 'blockerDays')),
    chassisShippedFromAlpineDate: asDateString(getField(record.fields, 'chassisShippedFromAlpineDate')),
    chassisArrivalExpectedDate,
    chassisArrivalActualDate,
    designChangeRequestedDate: asDateString(getField(record.fields, 'designChangeRequestedDate')),
    designChangeCompletedDate: asDateString(getField(record.fields, 'designChangeCompletedDate')),
    designApprovedDate,
    actualProductionTime: asString(getField(record.fields, 'actualProductionTime')),
    expectedCompletionDate,
    actualProductionCompletionDate,
    actualCompletionDate,
    shippedFromMevaDate,
    arrivedAtAlpineDate,
    shippingDaysToMeva: asNumber(getField(record.fields, 'shippingDaysToMeva')),
    shippingDaysToAlpine: asNumber(getField(record.fields, 'shippingDaysToAlpine')),
    daysAtMeva: asNumber(getField(record.fields, 'daysAtMeva')),
    daysMevaTookToFinish,
    scheduleVarianceDays,
    mevaNotes: asString(getField(record.fields, 'mevaNotes')),
    notes: asString(getField(record.fields, 'notes')),
    currentStatus: asString(getField(record.fields, 'currentStatus')),
    alpineAssessment: asString(getField(record.fields, 'alpineAssessment')),
    risk: calculateRisk(productionStatus, expectedCompletionDate, scheduleVarianceDays),
  };

  return {
    ...vehicle,
    shippingDaysToMeva: getShippingDaysAlpineToMEVA(vehicle),
    shippingDaysToAlpine: getShippingDaysMEVAToAlpine(vehicle),
    daysAtMeva: getDaysAtMEVA(vehicle),
  };
}

function getField(fields: Record<string, unknown>, key: FieldKey) {
  for (const alias of fieldAliases[key]) {
    if (fields[alias] !== undefined && fields[alias] !== null && fields[alias] !== '') {
      return fields[alias];
    }
  }

  return undefined;
}

function asString(value: unknown) {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value.map(String).join(', ');
  }

  return String(value).trim() || undefined;
}

function asNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[^0-9.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function asDateString(value: unknown) {
  if (!value) {
    return undefined;
  }

  const date = value instanceof Date ? value : new Date(String(value));

  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date.toISOString().slice(0, 10);
}

function normalizeStatus(status?: string): ProductionStatus {
  if (!status) {
    return 'Scheduled';
  }

  const cleaned = status.trim();
  const exact = STAGE_ORDER.find((knownStatus) => knownStatus === cleaned);

  if (exact) {
    return exact;
  }

  const legacyMap: Record<string, ProductionStatus> = {
    'Design Approval Pending': 'Design Confirmation Pending',
    'Ready to Ship': 'Ready for Shipment',
    Shipped: 'Shipped to Alpine',
    'QA/QC': 'Final Stages of Production',
    'On Hold': 'In Production',
  };

  return legacyMap[cleaned] || 'In Production';
}

function normalizeProductionSubStatus(value?: string): ProductionSubStatus | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();

  if (['blocked', 'blocker'].includes(normalized)) {
    return 'Blocked';
  }

  if (['on hold', 'hold', 'paused'].includes(normalized)) {
    return 'On Hold';
  }

  if (['running', 'active', 'ongoing'].includes(normalized)) {
    return 'Running';
  }

  return undefined;
}

function normalizeBlockerType(value?: string): ProductionBlockerType | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized.includes('design')) {
    return 'Design Confirmation Pending';
  }

  if (normalized.includes('material') || normalized.includes('part')) {
    return 'Material Pending';
  }

  if (normalized.includes('quality') || normalized.includes('qa') || normalized.includes('qc')) {
    return 'Quality Hold';
  }

  if (normalized.includes('client') || normalized.includes('customer') || normalized.includes('alpine')) {
    return 'Client Confirmation Pending';
  }

  return 'Other';
}

function normalizeBlockerStatus(value?: string): ProductionBlockerStatus | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();

  if (['open', 'active', 'pending'].includes(normalized)) {
    return 'Open';
  }

  if (['resolved', 'closed', 'complete', 'completed'].includes(normalized)) {
    return 'Resolved';
  }

  return undefined;
}

function calculateScheduleVariance(
  expectedCompletionDate?: string,
  completionDate?: string,
  status?: ProductionStatus,
) {
  if (!expectedCompletionDate) {
    return undefined;
  }

  const expected = new Date(expectedCompletionDate);
  const end = completionDate ? new Date(completionDate) : new Date();

  if (Number.isNaN(expected.getTime()) || Number.isNaN(end.getTime())) {
    return undefined;
  }

  if (status && isProductionCompleteStatus(status) && !completionDate) {
    return 0;
  }

  return Math.round((end.getTime() - expected.getTime()) / 86_400_000);
}

function calculateRisk(
  status: ProductionStatus,
  expectedCompletionDate?: string,
  scheduleVarianceDays?: number,
): OperationalRisk {
  if (isProductionCompleteStatus(status)) {
    return 'Done';
  }

  if (scheduleVarianceDays !== undefined && scheduleVarianceDays > 0) {
    return 'Late';
  }

  if (!expectedCompletionDate) {
    return 'Watch';
  }

  const daysUntilDue = Math.ceil(
    (new Date(expectedCompletionDate).getTime() - new Date().getTime()) / 86_400_000,
  );

  if (daysUntilDue <= 14) {
    return 'Watch';
  }

  return 'On Time';
}

function buildSummary(vehicles: ProductionVehicle[]): ProductionSummary {
  const bucketedVehicles = vehicles.map((vehicle) => ({
    vehicle,
    bucket: getDashboardBucket(vehicle),
    daysAtMeva: getDaysAtMEVA(vehicle),
  }));
  const vehiclesWithMevaDays = bucketedVehicles.filter((item) => typeof item.daysAtMeva === 'number');
  const totalMevaDays = vehiclesWithMevaDays.reduce(
    (total, item) => total + (item.daysAtMeva || 0),
    0,
  );

  return {
    totalOrdered: vehicles.length,
    atMevaProductionCycle: bucketedVehicles.filter((item) => item.bucket.isAtMeva).length,
    activeProduction: bucketedVehicles.filter((item) => item.bucket.isActiveProduction).length,
    inTransit: bucketedVehicles.filter((item) => item.bucket.isInTransit).length,
    completed: bucketedVehicles.filter((item) => item.bucket.isCompleted).length,
    chassisOnTheWay: bucketedVehicles.filter((item) => item.bucket.isTransitToMeva).length,
    readyForShipment: bucketedVehicles.filter((item) => item.bucket.isReadyForShipment).length,
    received: bucketedVehicles.filter((item) => item.bucket.isReceived).length,
    blockedProduction: bucketedVehicles.filter((item) => item.bucket.isBlockedProduction).length,
    delayedAtRisk: bucketedVehicles.filter((item) => item.bucket.isDelayedAtRisk).length,
    delayed: bucketedVehicles.filter((item) => item.vehicle.risk === 'Late').length,
    watchList: bucketedVehicles.filter((item) => item.vehicle.risk === 'Watch').length,
    averageDaysAtMeva: vehiclesWithMevaDays.length
      ? Math.round(totalMevaDays / vehiclesWithMevaDays.length)
      : 0,
  };
}
