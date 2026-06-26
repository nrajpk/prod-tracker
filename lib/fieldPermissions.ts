import type { FieldObjection, FieldObjectionResponsibleRole, ProductionVehicle, UserRole } from '@/lib/types';
import type { JourneyPhase, TimelineStageState } from '@/lib/vehicleTimeline';

export type FieldKey = keyof ProductionVehicle | 'phase' | 'progress' | 'health' | 'delayVariance' | 'stageState';
export type FieldOwner = 'ALPINE' | 'MEVA' | 'SHARED' | 'SYSTEM' | 'UNCLEAR';
export type ResponsibleParty = 'Alpine' | 'MEVA' | 'Shared' | 'System' | 'Needs confirmation';
export type WorkflowSection =
  | 'Vehicle Summary'
  | 'Current Position'
  | 'Alpine to MEVA Movement'
  | 'MEVA Production Cycle'
  | 'MEVA to Alpine Movement'
  | 'Closure / Notes'
  | 'Calculated Status';

export interface FieldDependency {
  key: FieldKey;
  label: string;
  stage: WorkflowSection | JourneyPhase;
  ownerRole: FieldOwner;
  editableBy: UserRole[];
  objectableBy: UserRole[];
  responsibleParty: ResponsibleParty;
  isCalculated: boolean;
  tooltip?: string;
}

export interface FieldObjectionInput {
  vehicleId?: string;
  fieldKey?: string;
  currentValue?: unknown;
  objectedBy: UserRole;
  reason?: string;
  suggestedValue?: string;
  comment?: string;
}

const oppositeRole: Record<'ALPINE' | 'MEVA', UserRole[]> = {
  ALPINE: ['MEVA'],
  MEVA: ['ALPINE'],
};

function ownedField(
  key: FieldKey,
  label: string,
  stage: FieldDependency['stage'],
  ownerRole: 'ALPINE' | 'MEVA',
  tooltip?: string,
): FieldDependency {
  return {
    key,
    label,
    stage,
    ownerRole,
    editableBy: [ownerRole],
    objectableBy: oppositeRole[ownerRole],
    responsibleParty: ownerRole === 'ALPINE' ? 'Alpine' : 'MEVA',
    isCalculated: false,
    tooltip,
  };
}

function sharedField(
  key: FieldKey,
  label: string,
  stage: FieldDependency['stage'],
  tooltip?: string,
): FieldDependency {
  return {
    key,
    label,
    stage,
    ownerRole: 'SHARED',
    editableBy: ['MEVA', 'ALPINE'],
    objectableBy: ['MEVA', 'ALPINE'],
    responsibleParty: 'Shared',
    isCalculated: false,
    tooltip,
  };
}

function calculatedField(
  key: FieldKey,
  label: string,
  stage: FieldDependency['stage'],
  tooltip?: string,
): FieldDependency {
  return {
    key,
    label,
    stage,
    ownerRole: 'SYSTEM',
    editableBy: [],
    objectableBy: [],
    responsibleParty: 'System',
    isCalculated: true,
    tooltip,
  };
}

export const FIELD_DEPENDENCY_MAP = {
  vehicleNumber: ownedField('vehicleNumber', 'Vehicle #', 'Vehicle Summary', 'ALPINE', 'Unique order or vehicle reference number.'),
  vehicle: ownedField('vehicle', 'Vehicle', 'Vehicle Summary', 'ALPINE', 'The vehicle make or model.'),
  designStyle: ownedField('designStyle', 'Build / Design', 'Vehicle Summary', 'ALPINE', 'The vehicle build type or design style.'),
  modelYear: ownedField('modelYear', 'Model Year', 'Vehicle Summary', 'ALPINE', 'The model year of the base vehicle.'),
  vin: ownedField('vin', 'VIN', 'Vehicle Summary', 'ALPINE', 'The official vehicle identification number.'),
  armoringLevel: ownedField('armoringLevel', 'Armouring Level', 'Vehicle Summary', 'ALPINE', 'The protection level required for the vehicle.'),
  facility: ownedField('facility', 'Facility / Plant', 'Vehicle Summary', 'MEVA', 'The location where the vehicle work is handled.'),

  productionStatus: ownedField('productionStatus', 'Workflow Stage', 'Current Position', 'MEVA', 'The exact current stage of the vehicle.'),
  productionSubStatus: ownedField('productionSubStatus', 'Production Sub-Status', 'Current Position', 'MEVA'),
  blockerType: calculatedField('blockerType', 'Blocker Type', 'Current Position'),
  blockerStatus: ownedField('blockerStatus', 'Blocker Status', 'Current Position', 'MEVA'),
  blockerStartedAt: ownedField('blockerStartedAt', 'Blocker Started', 'Current Position', 'MEVA'),
  blockerResolvedAt: ownedField('blockerResolvedAt', 'Blocker Resolved', 'Current Position', 'MEVA'),
  blockerDays: calculatedField('blockerDays', 'Blocker Days', 'Current Position'),

  chassisShippedFromAlpineDate: ownedField(
    'chassisShippedFromAlpineDate',
    'Chassis Shipped from Alpine',
    'Alpine to MEVA Movement',
    'ALPINE',
    'The date Alpine sent the chassis to MEVA / MAVJ.',
  ),
  chassisArrivalExpectedDate: ownedField('chassisArrivalExpectedDate', 'Expected Chassis Arrival at MEVA', 'Alpine to MEVA Movement', 'MEVA'),
  chassisArrivalActualDate: ownedField(
    'chassisArrivalActualDate',
    'Chassis Arrived at MEVA',
    'Alpine to MEVA Movement',
    'MEVA',
    'The date the chassis reached the production facility.',
  ),
  shippingDaysToMeva: calculatedField(
    'shippingDaysToMeva',
    'Shipping Days Alpine to MEVA',
    'Alpine to MEVA Movement',
    'Number of days taken for the chassis to reach MEVA / MAVJ.',
  ),

  designChangeRequestedDate: ownedField('designChangeRequestedDate', 'Design Change Requested', 'MEVA Production Cycle', 'ALPINE'),
  designChangeCompletedDate: ownedField(
    'designChangeCompletedDate',
    'Design Change / Confirmation Time',
    'MEVA Production Cycle',
    'MEVA',
    'Time taken to complete design confirmation or design changes.',
  ),
  designApprovedDate: ownedField('designApprovedDate', 'Design Approval', 'MEVA Production Cycle', 'ALPINE'),
  actualProductionTime: ownedField('actualProductionTime', 'Actual Production Time', 'MEVA Production Cycle', 'MEVA', 'Time spent in production work.'),
  expectedCompletionDate: ownedField('expectedCompletionDate', 'Expected Completion Date', 'MEVA Production Cycle', 'MEVA', 'The expected completion date.'),
  actualProductionCompletionDate: ownedField(
    'actualProductionCompletionDate',
    'Actual Production Completion Date',
    'MEVA Production Cycle',
    'MEVA',
    'The date production work was completed.',
  ),
  actualCompletionDate: ownedField(
    'actualCompletionDate',
    'Final Completion / Verification Date',
    'MEVA Production Cycle',
    'MEVA',
    'The date final checks or verification were completed.',
  ),
  daysAtMeva: calculatedField('daysAtMeva', 'Days at MEVA', 'MEVA Production Cycle', 'Total time the vehicle has spent at MEVA / MAVJ.'),
  daysMevaTookToFinish: calculatedField('daysMevaTookToFinish', 'Days MEVA Took to Finish', 'MEVA Production Cycle'),
  scheduleVarianceDays: calculatedField('scheduleVarianceDays', 'Schedule Variance', 'MEVA Production Cycle', 'Difference between planned completion and actual completion.'),

  shippedFromMevaDate: ownedField(
    'shippedFromMevaDate',
    'Completed Vehicle Shipped from MEVA',
    'MEVA to Alpine Movement',
    'MEVA',
    'The date the completed vehicle was sent back to Alpine.',
  ),
  arrivedAtAlpineDate: ownedField('arrivedAtAlpineDate', 'Date Arrived at Alpine', 'MEVA to Alpine Movement', 'ALPINE', 'The date Alpine received the completed vehicle.'),
  shippingDaysToAlpine: calculatedField(
    'shippingDaysToAlpine',
    'Shipping Days MEVA to Alpine',
    'MEVA to Alpine Movement',
    'Number of days taken for the completed vehicle to reach Alpine.',
  ),

  currentStatus: ownedField('currentStatus', 'Current Status', 'Closure / Notes', 'MEVA'),
  notes: sharedField('notes', 'Latest Note', 'Closure / Notes', 'Most recent operational note for the vehicle.'),
  mevaNotes: {
    ...ownedField('mevaNotes', 'Private MEVA Notes', 'Closure / Notes', 'MEVA'),
    objectableBy: [],
  },
  alpineAssessment: ownedField(
    'alpineAssessment',
    'Alpine Assessment Upon Receipt',
    'Closure / Notes',
    'ALPINE',
    'Alpine condition check or comments after receiving the vehicle.',
  ),

  risk: calculatedField('risk', 'Health', 'Calculated Status', 'Shows whether the vehicle is on track, delayed, or needs attention.'),
  phase: calculatedField('phase', 'Phase', 'Calculated Status', 'The broad journey position of the vehicle.'),
  progress: calculatedField('progress', 'Progress', 'Calculated Status', 'Shows how far the vehicle has moved through the 8-stage journey.'),
  health: calculatedField('health', 'Health', 'Calculated Status', 'Shows whether the vehicle is on track, delayed, or needs attention.'),
  delayVariance: calculatedField('delayVariance', 'Delay / Variance', 'Calculated Status'),
  stageState: calculatedField('stageState', 'Stage state: Completed / Current / Pending / Delayed', 'Calculated Status'),
} as const satisfies Record<string, FieldDependency>;

export function getFieldDependency(fieldKey: FieldKey | string) {
  return FIELD_DEPENDENCY_MAP[fieldKey as keyof typeof FIELD_DEPENDENCY_MAP];
}

export function canEditField(userRole: UserRole, fieldKey: FieldKey | string) {
  const dependency = getFieldDependency(fieldKey);
  return Boolean(dependency && !dependency.isCalculated && (dependency.editableBy as readonly UserRole[]).includes(userRole));
}

export function canObjectToField(userRole: UserRole, fieldKey: FieldKey | string) {
  const dependency = getFieldDependency(fieldKey);
  return Boolean(dependency && (dependency.objectableBy as readonly UserRole[]).includes(userRole));
}

export function canCreateObjection(userRole: UserRole, fieldKey: FieldKey | string) {
  const dependency = getFieldDependency(fieldKey);
  return Boolean(dependency && !dependency.isCalculated && canObjectToField(userRole, fieldKey));
}

export function getObjectionResponsibleRole(
  fieldKey: FieldKey | string,
  objectedByRole: UserRole,
): FieldObjectionResponsibleRole | undefined {
  const dependency = getFieldDependency(fieldKey);

  if (!dependency || dependency.isCalculated) {
    return undefined;
  }

  if (dependency.ownerRole === 'MEVA' || dependency.ownerRole === 'ALPINE') {
    return dependency.ownerRole;
  }

  if (dependency.ownerRole === 'SHARED') {
    if (objectedByRole === 'MEVA') {
      return 'ALPINE';
    }

    if (objectedByRole === 'ALPINE') {
      return 'MEVA';
    }

    return 'SHARED';
  }

  return undefined;
}

export function validateFieldObjection(input: FieldObjectionInput) {
  if (!input.vehicleId?.trim()) {
    return 'Vehicle is required.';
  }

  if (!input.fieldKey?.trim()) {
    return 'Field key is required.';
  }

  if (input.currentValue === undefined) {
    return 'Current value is required.';
  }

  const dependency = getFieldDependency(input.fieldKey);

  if (!dependency) {
    return 'Unknown field key.';
  }

  if (dependency.isCalculated) {
    return `${dependency.label} is calculated and cannot be objected.`;
  }

  if (!canCreateObjection(input.objectedBy, input.fieldKey)) {
    return `${input.objectedBy} cannot object to ${dependency.label}.`;
  }

  if (!input.reason?.trim()) {
    return 'Objection reason is required.';
  }

  if (!input.suggestedValue?.trim()) {
    return 'Suggested corrected value is required.';
  }

  return null;
}

export function createFieldObjectionPayload(
  input: FieldObjectionInput,
): Omit<FieldObjection, 'id' | 'status' | 'createdAt' | 'updatedAt'> {
  const validationError = validateFieldObjection(input);

  if (validationError) {
    throw new Error(validationError);
  }

  const dependency = getFieldDependency(input.fieldKey!);
  const responsibleRole = getObjectionResponsibleRole(input.fieldKey!, input.objectedBy);

  if (!dependency || !responsibleRole) {
    throw new Error('Field objection could not be created for this field.');
  }

  return {
    vehicleId: input.vehicleId!.trim(),
    fieldKey: dependency.key,
    fieldLabel: dependency.label,
    stage: dependency.stage,
    currentValue: stringifyObjectionValue(input.currentValue),
    objectedBy: input.objectedBy,
    responsibleRole,
    reason: input.reason!.trim(),
    suggestedValue: input.suggestedValue!.trim(),
    comment: input.comment?.trim() || undefined,
  };
}

export function isCalculatedField(fieldKey: FieldKey | string) {
  return Boolean(getFieldDependency(fieldKey)?.isCalculated);
}

export function getFieldOwner(fieldKey: FieldKey | string) {
  return getFieldDependency(fieldKey)?.ownerRole ?? 'UNCLEAR';
}

export function getResponsibleParty(fieldKey: FieldKey | string) {
  return getFieldDependency(fieldKey)?.responsibleParty ?? 'Needs confirmation';
}

export function getFieldLabel(fieldKey: FieldKey | string) {
  return getFieldDependency(fieldKey)?.label ?? String(fieldKey);
}

export function getFieldTooltip(fieldKey: FieldKey | string) {
  return getFieldDependency(fieldKey)?.tooltip;
}

export function getEditableFieldsForRole(userRole: UserRole) {
  return Object.values(FIELD_DEPENDENCY_MAP).filter((dependency) => canEditField(userRole, dependency.key));
}

export function getUnclearOwnershipFields() {
  return Object.values(FIELD_DEPENDENCY_MAP).filter((dependency) => dependency.ownerRole === 'UNCLEAR');
}

export function isStageStateField(fieldKey: FieldKey | string): fieldKey is TimelineStageState | 'stageState' {
  return fieldKey === 'completed' || fieldKey === 'current' || fieldKey === 'pending' || fieldKey === 'stageState';
}

function stringifyObjectionValue(value: unknown) {
  if (value === undefined || value === null) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return JSON.stringify(value);
}
