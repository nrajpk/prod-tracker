import type {
  ProductionBlocker,
  ProductionStatus,
  ProductionVehicle,
} from '@/lib/types';

export type JourneyPhase =
  | 'Scheduled'
  | 'Transit to MEVA'
  | 'At MEVA / Production Cycle'
  | 'Transit to Alpine'
  | 'Received';

export type TimelineStageState = 'completed' | 'current' | 'pending';
export type FieldOwner = 'ALPINE' | 'MEVA' | 'MAVJ' | 'SHARED';
export type DashboardBucketKey =
  | 'orders'
  | 'atMeva'
  | 'activeProduction'
  | 'inTransit'
  | 'delayedAtRisk'
  | 'received';

export interface StageSupportingField {
  key: keyof ProductionVehicle;
  label: string;
  value: string;
  owner: FieldOwner;
  defaultVisible: boolean;
}

export interface StageFieldDefinition {
  key: keyof ProductionVehicle;
  label: string;
  owner: FieldOwner;
  defaultVisible?: boolean;
}

export interface VehicleDetailFieldSection {
  title: string;
  fields: StageFieldDefinition[];
}

export interface VehicleProgress {
  currentIndex: number;
  currentStageNumber: number;
  totalStages: number;
  percentage: number;
  stage: ProductionStatus;
  phase: JourneyPhase;
  label: string;
}

export interface DelaySummary {
  isDelayed: boolean;
  text: string;
  days?: number;
  stage: ProductionStatus;
}

export interface DashboardBucket {
  phase: JourneyPhase;
  status: ProductionStatus;
  isOrder: boolean;
  isCompleted: boolean;
  isActiveProduction: boolean;
  isTransitToMeva: boolean;
  isInTransit: boolean;
  isAtMeva: boolean;
  isReadyForShipment: boolean;
  isTransitToAlpine: boolean;
  isReceived: boolean;
  isBlockedProduction: boolean;
  isDelayedAtRisk: boolean;
}

export const STAGE_ORDER: ProductionStatus[] = [
  'Scheduled',
  'Shipped to MEVA',
  'Design Confirmation Pending',
  'In Production',
  'Final Stages of Production',
  'Ready for Shipment',
  'Shipped to Alpine',
  'Received',
];

export const timelineStages = STAGE_ORDER;

export const PHASE_ORDER: JourneyPhase[] = [
  'Scheduled',
  'Transit to MEVA',
  'At MEVA / Production Cycle',
  'Transit to Alpine',
  'Received',
];

export const STATUS_TO_PHASE_MAP: Record<ProductionStatus, JourneyPhase> = {
  Scheduled: 'Scheduled',
  'Shipped to MEVA': 'Transit to MEVA',
  'Design Confirmation Pending': 'At MEVA / Production Cycle',
  'In Production': 'At MEVA / Production Cycle',
  'Final Stages of Production': 'At MEVA / Production Cycle',
  'Ready for Shipment': 'At MEVA / Production Cycle',
  'Shipped to Alpine': 'Transit to Alpine',
  Received: 'Received',
};

export const FIELD_OWNERSHIP_MAP: Partial<Record<keyof ProductionVehicle, FieldOwner>> = {
  vehicleNumber: 'SHARED',
  vehicle: 'SHARED',
  designStyle: 'SHARED',
  modelYear: 'SHARED',
  armoringLevel: 'SHARED',
  expectedCompletionDate: 'MEVA',
  productionStatus: 'MEVA',
  productionSubStatus: 'MEVA',
  blockerType: 'SHARED',
  blockerStatus: 'MEVA',
  blockerStartedAt: 'MEVA',
  blockerResolvedAt: 'MEVA',
  blockerDays: 'MEVA',
  chassisShippedFromAlpineDate: 'ALPINE',
  facility: 'MEVA',
  vin: 'SHARED',
  shippingDaysToMeva: 'SHARED',
  designChangeCompletedDate: 'SHARED',
  notes: 'SHARED',
  scheduleVarianceDays: 'MEVA',
  chassisArrivalActualDate: 'MEVA',
  chassisArrivalExpectedDate: 'MEVA',
  actualProductionTime: 'MEVA',
  daysAtMeva: 'MEVA',
  daysMevaTookToFinish: 'MEVA',
  actualProductionCompletionDate: 'MEVA',
  actualCompletionDate: 'MEVA',
  currentStatus: 'MEVA',
  shippedFromMevaDate: 'MEVA',
  shippingDaysToAlpine: 'SHARED',
  arrivedAtAlpineDate: 'ALPINE',
  alpineAssessment: 'ALPINE',
};

export const STAGE_OWNER_MAP: Record<ProductionStatus, FieldOwner[]> = {
  Scheduled: ['ALPINE', 'MEVA'],
  'Shipped to MEVA': ['ALPINE'],
  'Design Confirmation Pending': ['ALPINE', 'MEVA'],
  'In Production': ['MEVA', 'MAVJ'],
  'Final Stages of Production': ['MEVA', 'MAVJ'],
  'Ready for Shipment': ['MEVA', 'MAVJ'],
  'Shipped to Alpine': ['MEVA', 'MAVJ'],
  Received: ['ALPINE'],
};

export const STAGE_FIELD_MAP: Record<ProductionStatus, StageFieldDefinition[]> = {
  Scheduled: [
    { key: 'expectedCompletionDate', label: 'Planned Finish', owner: 'MEVA', defaultVisible: true },
    { key: 'productionStatus', label: 'Current Production Status', owner: 'MEVA', defaultVisible: true },
    { key: 'vehicleNumber', label: 'Order Reference', owner: 'SHARED' },
  ],
  'Shipped to MEVA': [
    { key: 'chassisShippedFromAlpineDate', label: 'Chassis Shipped from Alpine', owner: 'ALPINE', defaultVisible: true },
    { key: 'shippingDaysToMeva', label: 'Shipping Days Alpine to MEVA', owner: 'SHARED', defaultVisible: true },
    { key: 'facility', label: 'Destination Facility', owner: 'MEVA', defaultVisible: true },
  ],
  'Design Confirmation Pending': [
    { key: 'chassisArrivalActualDate', label: 'Chassis Arrived at MEVA', owner: 'MEVA', defaultVisible: true },
    { key: 'designStyle', label: 'Design Style', owner: 'SHARED', defaultVisible: true },
    { key: 'designChangeCompletedDate', label: 'Design Change / Confirmation Time', owner: 'SHARED', defaultVisible: true },
    { key: 'notes', label: 'Design Notes', owner: 'SHARED', defaultVisible: true },
    { key: 'scheduleVarianceDays', label: 'Schedule Variance', owner: 'MEVA' },
  ],
  'In Production': [
    { key: 'actualProductionTime', label: 'Actual Production Time', owner: 'MEVA', defaultVisible: true },
    { key: 'daysAtMeva', label: 'Days at MEVA', owner: 'MEVA', defaultVisible: true },
    { key: 'expectedCompletionDate', label: 'Expected Completion Date', owner: 'MEVA', defaultVisible: true },
    { key: 'productionStatus', label: 'Production Status', owner: 'MEVA', defaultVisible: true },
    { key: 'productionSubStatus', label: 'Production Sub-Status', owner: 'MEVA' },
    { key: 'blockerType', label: 'Blocker Type', owner: 'SHARED' },
    { key: 'blockerStatus', label: 'Blocker Status', owner: 'MEVA' },
    { key: 'blockerStartedAt', label: 'Blocker Started', owner: 'MEVA' },
    { key: 'blockerResolvedAt', label: 'Blocker Resolved', owner: 'MEVA' },
    { key: 'blockerDays', label: 'Blocker Days', owner: 'MEVA' },
    { key: 'chassisArrivalActualDate', label: 'Chassis Arrived at MEVA', owner: 'MEVA' },
    { key: 'daysMevaTookToFinish', label: 'Days MEVA took to finish', owner: 'MEVA' },
  ],
  'Final Stages of Production': [
    { key: 'actualProductionCompletionDate', label: 'Production Completed Date', owner: 'MEVA', defaultVisible: true },
    { key: 'scheduleVarianceDays', label: 'Schedule Variance', owner: 'MEVA', defaultVisible: true },
    { key: 'currentStatus', label: 'Final Checks / QA Notes', owner: 'MEVA', defaultVisible: true },
    { key: 'actualCompletionDate', label: 'Final Completion / Verification Date', owner: 'MEVA' },
    { key: 'notes', label: 'Latest Note', owner: 'SHARED' },
  ],
  'Ready for Shipment': [
    { key: 'actualCompletionDate', label: 'Final Completion / Verification Date', owner: 'MEVA', defaultVisible: true },
    { key: 'actualProductionCompletionDate', label: 'Ready Since', owner: 'MEVA', defaultVisible: true },
    { key: 'currentStatus', label: 'Pending Dispatch Notes', owner: 'MEVA', defaultVisible: true },
    { key: 'daysAtMeva', label: 'Days at MEVA', owner: 'MEVA' },
  ],
  'Shipped to Alpine': [
    { key: 'shippedFromMevaDate', label: 'Shipped from MEVA', owner: 'MEVA', defaultVisible: true },
    { key: 'shippingDaysToAlpine', label: 'Shipping Days MEVA to Alpine', owner: 'SHARED', defaultVisible: true },
    { key: 'facility', label: 'Facility / Plant', owner: 'MEVA', defaultVisible: true },
    { key: 'vin', label: 'VIN', owner: 'SHARED' },
  ],
  Received: [
    { key: 'arrivedAtAlpineDate', label: 'Arrived at Alpine', owner: 'ALPINE', defaultVisible: true },
    { key: 'alpineAssessment', label: 'Alpine Assessment', owner: 'ALPINE', defaultVisible: true },
    { key: 'notes', label: 'Final Comments', owner: 'SHARED', defaultVisible: true },
  ],
};

export const VEHICLE_DETAIL_FIELD_SECTIONS: VehicleDetailFieldSection[] = [
  {
    title: 'Vehicle Summary',
    fields: [
      { key: 'vehicleNumber', label: 'Vehicle #', owner: 'SHARED' },
      { key: 'designStyle', label: 'Build / Design', owner: 'SHARED' },
      { key: 'modelYear', label: 'Model Year', owner: 'SHARED' },
      { key: 'vin', label: 'VIN', owner: 'SHARED' },
      { key: 'armoringLevel', label: 'Armouring Level', owner: 'SHARED' },
      { key: 'facility', label: 'Facility / Plant', owner: 'MEVA' },
    ],
  },
  {
    title: 'Current Position',
    fields: [
      { key: 'productionStatus', label: 'Workflow Stage', owner: 'MEVA' },
      { key: 'productionSubStatus', label: 'Production Sub-Status', owner: 'MEVA' },
      { key: 'blockerType', label: 'Blocker Type', owner: 'SHARED' },
      { key: 'blockerStatus', label: 'Blocker Status', owner: 'MEVA' },
    ],
  },
  {
    title: 'Alpine to MEVA Movement',
    fields: [
      { key: 'chassisShippedFromAlpineDate', label: 'Chassis Shipped from Alpine', owner: 'ALPINE' },
      { key: 'chassisArrivalActualDate', label: 'Chassis Arrived at MEVA', owner: 'MEVA' },
      { key: 'shippingDaysToMeva', label: 'Shipping Days Alpine to MEVA', owner: 'SHARED' },
    ],
  },
  {
    title: 'MEVA Production Cycle',
    fields: [
      { key: 'designChangeCompletedDate', label: 'Design Change / Confirmation Time', owner: 'SHARED' },
      { key: 'actualProductionTime', label: 'Actual Production Time', owner: 'MEVA' },
      { key: 'expectedCompletionDate', label: 'Expected Completion Date', owner: 'MEVA' },
      { key: 'actualProductionCompletionDate', label: 'Actual Production Completion Date', owner: 'MEVA' },
      { key: 'actualCompletionDate', label: 'Final Completion / Verification Date', owner: 'MEVA' },
      { key: 'daysAtMeva', label: 'Days at MEVA', owner: 'MEVA' },
      { key: 'daysMevaTookToFinish', label: 'Days MEVA Took to Finish', owner: 'MEVA' },
      { key: 'scheduleVarianceDays', label: 'Schedule Variance', owner: 'MEVA' },
    ],
  },
  {
    title: 'MEVA to Alpine Movement',
    fields: [
      { key: 'shippedFromMevaDate', label: 'Completed Vehicle Shipped from MEVA', owner: 'MEVA' },
      { key: 'arrivedAtAlpineDate', label: 'Date Arrived at Alpine', owner: 'ALPINE' },
      { key: 'shippingDaysToAlpine', label: 'Shipping Days MEVA to Alpine', owner: 'SHARED' },
    ],
  },
  {
    title: 'Closure / Notes',
    fields: [
      { key: 'currentStatus', label: 'Current Status', owner: 'MEVA' },
      { key: 'notes', label: 'Latest Note', owner: 'SHARED' },
      { key: 'alpineAssessment', label: 'Alpine Assessment Upon Receipt', owner: 'ALPINE' },
    ],
  },
];

export const FIELD_TOOLTIP_TEXT: Record<string, string> = {
  'Vehicle #': 'Unique order or vehicle reference number.',
  'Order Reference': 'Unique order or vehicle reference number.',
  'Build / Design': 'The vehicle build type or design style.',
  'Design Style': 'The vehicle build type or design style.',
  VIN: 'The official vehicle identification number.',
  'Model Year': 'The model year of the base vehicle.',
  'Armouring Level': 'The protection level required for the vehicle.',
  'Facility / Plant': 'The location where the vehicle work is handled.',
  Facility: 'The location where the vehicle work is handled.',
  'Destination Facility': 'The location where the vehicle work is handled.',
  Phase: 'The broad journey position of the vehicle.',
  'Workflow Stage': 'The exact current stage of the vehicle.',
  Health: 'Shows whether the vehicle is on track, delayed, or needs attention.',
  Progress: 'Shows how far the vehicle has moved through the 8-stage journey.',
  'Planned Finish': 'The expected completion date.',
  'Expected Completion Date': 'The expected completion date.',
  'Actual / Forecast Finish': 'The actual finish date if available, otherwise the expected finish date.',
  'Chassis Shipped from Alpine': 'The date Alpine sent the chassis to MEVA / MAVJ.',
  'Chassis Arrived at MEVA': 'The date the chassis reached the production facility.',
  'Shipping Days Alpine to MEVA': 'Number of days taken for the chassis to reach MEVA / MAVJ.',
  'Design Change / Confirmation Time': 'Time taken to complete design confirmation or design changes.',
  'Actual Production Time': 'Time spent in production work.',
  'Days at MEVA': 'Total time the vehicle has spent at MEVA / MAVJ.',
  'Production Completed Date': 'The date production work was completed.',
  'Final Completion / Verification Date': 'The date final checks or verification were completed.',
  'Schedule Variance': 'Difference between planned completion and actual completion.',
  'Ready Since': 'The date the vehicle became ready for shipment.',
  'Shipped from MEVA': 'The date the completed vehicle was sent back to Alpine.',
  'Shipping Days MEVA to Alpine': 'Number of days taken for the completed vehicle to reach Alpine.',
  'Arrived at Alpine': 'The date Alpine received the completed vehicle.',
  'Alpine Assessment': 'Alpine condition check or comments after receiving the vehicle.',
  'Latest Note': 'Most recent operational note for the vehicle.',
  'Final Comments': 'Most recent operational note for the vehicle.',
  'Current Production Status': 'The exact current stage of the vehicle.',
  'Production Status': 'The exact current stage of the vehicle.',
  'Design Notes': 'Most recent design-related note for this stage.',
  'Final Checks / QA Notes': 'Most recent final check or quality note.',
  'Pending Dispatch Notes': 'Most recent note before the vehicle leaves MEVA / MAVJ.',
};

export function getFieldTooltip(label: string) {
  return FIELD_TOOLTIP_TEXT[label];
}

export function getWorkflowStatus(vehicle: ProductionVehicle) {
  return vehicle.productionStatus;
}

export function getProductionBlocker(vehicle: ProductionVehicle): ProductionBlocker | undefined {
  if (getWorkflowStatus(vehicle) !== 'In Production') {
    return undefined;
  }

  const hasBlockerSignal =
    vehicle.blockerType ||
    vehicle.blockerStatus ||
    vehicle.blockerStartedAt ||
    vehicle.productionSubStatus === 'Blocked' ||
    vehicle.productionSubStatus === 'On Hold';

  if (!hasBlockerSignal) {
    return undefined;
  }

  return {
    type: vehicle.blockerType || 'Other',
    status: vehicle.blockerStatus || 'Open',
    subStatus: vehicle.productionSubStatus,
    startedAt: vehicle.blockerStartedAt,
    resolvedAt: vehicle.blockerResolvedAt,
    days: getBlockerDays(vehicle),
  };
}

export function hasOpenProductionBlocker(vehicle: ProductionVehicle) {
  return getProductionBlocker(vehicle)?.status === 'Open';
}

export function getJourneyPhase(vehicle: ProductionVehicle) {
  return STATUS_TO_PHASE_MAP[getWorkflowStatus(vehicle)];
}

export function getStatusesForPhase(phase: JourneyPhase) {
  return STAGE_ORDER.filter((status) => STATUS_TO_PHASE_MAP[status] === phase);
}

export function getStageIndex(stage: ProductionStatus) {
  return STAGE_ORDER.indexOf(stage);
}

export function getStageState(vehicleStatus: ProductionStatus, timelineStatus: ProductionStatus): TimelineStageState {
  const vehicleIndex = getStageIndex(vehicleStatus);
  const timelineIndex = getStageIndex(timelineStatus);

  if (timelineIndex < vehicleIndex) {
    return 'completed';
  }

  if (timelineIndex === vehicleIndex) {
    return 'current';
  }

  return 'pending';
}

export function getStageOwner(stage: ProductionStatus) {
  return STAGE_OWNER_MAP[stage].join(' / ');
}

export function getStageSupportingFields(
  vehicle: ProductionVehicle,
  stage: ProductionStatus,
  options: { defaultOnly?: boolean } = {},
): StageSupportingField[] {
  return STAGE_FIELD_MAP[stage]
    .filter((definition) => !options.defaultOnly || definition.defaultVisible)
    .map((definition) => ({
      ...definition,
      defaultVisible: Boolean(definition.defaultVisible),
      value: formatFieldValue(vehicle, definition.key),
    }))
    .filter((item) => item.value !== '-');
}

export function getVehicleProgress(vehicle: ProductionVehicle): VehicleProgress {
  const stage = getWorkflowStatus(vehicle);
  const currentIndex = Math.max(getStageIndex(stage), 0);
  const totalStages = STAGE_ORDER.length;
  const currentStageNumber = currentIndex + 1;
  const percentage = Math.round((currentStageNumber / totalStages) * 100);

  return {
    currentIndex,
    currentStageNumber,
    totalStages,
    percentage,
    stage,
    phase: getJourneyPhase(vehicle),
    label: `Stage ${currentStageNumber} of ${totalStages} - ${stage}`,
  };
}

export function getDashboardBucket(vehicle: ProductionVehicle): DashboardBucket {
  const status = getWorkflowStatus(vehicle);
  const phase = getJourneyPhase(vehicle);

  return {
    phase,
    status,
    isOrder: true,
    isCompleted: isProductionCompleteStatus(status),
    isActiveProduction: isActiveProductionStatus(status),
    isTransitToMeva: isTransitToMevaStatus(status),
    isInTransit: isInTransitStatus(status),
    isAtMeva: isAtMevaStatus(status),
    isReadyForShipment: status === 'Ready for Shipment',
    isTransitToAlpine: status === 'Shipped to Alpine',
    isReceived: status === 'Received',
    isBlockedProduction: hasOpenProductionBlocker(vehicle),
    isDelayedAtRisk: isDelayedOrAtRisk(vehicle),
  };
}

export function matchesDashboardBucket(vehicle: ProductionVehicle, bucket: DashboardBucketKey) {
  const dashboardBucket = getDashboardBucket(vehicle);

  if (bucket === 'orders') {
    return dashboardBucket.isOrder;
  }

  if (bucket === 'atMeva') {
    return dashboardBucket.isAtMeva;
  }

  if (bucket === 'activeProduction') {
    return dashboardBucket.isActiveProduction;
  }

  if (bucket === 'inTransit') {
    return dashboardBucket.isInTransit;
  }

  if (bucket === 'delayedAtRisk') {
    return dashboardBucket.isDelayedAtRisk;
  }

  return dashboardBucket.isReceived;
}

export function getDelaySummary(vehicle: ProductionVehicle): DelaySummary {
  const stage = getWorkflowStatus(vehicle);

  if (typeof vehicle.scheduleVarianceDays === 'number' && vehicle.scheduleVarianceDays > 0) {
    return {
      isDelayed: true,
      days: vehicle.scheduleVarianceDays,
      stage,
      text: `${vehicle.scheduleVarianceDays}d late at ${stage}`,
    };
  }

  if (vehicle.risk === 'Late') {
    return {
      isDelayed: true,
      stage,
      text: `Marked late at ${stage}`,
    };
  }

  return {
    isDelayed: false,
    stage,
    text: '',
  };
}

export function getVehicleHealth(vehicle: ProductionVehicle) {
  return vehicle.risk;
}

export function isDelayedOrAtRisk(vehicle: ProductionVehicle) {
  const health = getVehicleHealth(vehicle);
  return health === 'Late' || health === 'Watch';
}

export function getDaysAtMEVA(vehicle: ProductionVehicle) {
  if (typeof vehicle.daysAtMeva === 'number') {
    return vehicle.daysAtMeva;
  }

  const start = vehicle.chassisArrivalActualDate || vehicle.chassisArrivalExpectedDate;

  if (!start) {
    return undefined;
  }

  return calculateDaysBetween(start, getMevaExitDate(vehicle) || new Date());
}

export function getGrossProductionDays(vehicle: ProductionVehicle) {
  if (typeof vehicle.daysMevaTookToFinish === 'number') {
    return vehicle.daysMevaTookToFinish;
  }

  const start = vehicle.designApprovedDate || vehicle.chassisArrivalActualDate || vehicle.chassisArrivalExpectedDate;
  const end =
    vehicle.actualProductionCompletionDate ||
    vehicle.actualCompletionDate ||
    vehicle.shippedFromMevaDate ||
    (getWorkflowStatus(vehicle) === 'In Production' ? new Date() : undefined);

  return calculateDaysBetween(start, end);
}

export function getBlockerDays(vehicle: ProductionVehicle) {
  if (typeof vehicle.blockerDays === 'number') {
    return vehicle.blockerDays;
  }

  return calculateDaysBetween(vehicle.blockerStartedAt, vehicle.blockerResolvedAt || new Date());
}

export function getNetActiveProductionDays(vehicle: ProductionVehicle) {
  const grossDays = getGrossProductionDays(vehicle);

  if (typeof grossDays !== 'number') {
    return undefined;
  }

  return Math.max(0, grossDays - (getBlockerDays(vehicle) || 0));
}

export function getShippingDaysAlpineToMEVA(vehicle: ProductionVehicle) {
  if (typeof vehicle.shippingDaysToMeva === 'number') {
    return vehicle.shippingDaysToMeva;
  }

  return calculateDaysBetween(
    vehicle.chassisShippedFromAlpineDate,
    vehicle.chassisArrivalActualDate || vehicle.chassisArrivalExpectedDate,
  );
}

export function getShippingDaysMEVAToAlpine(vehicle: ProductionVehicle) {
  if (typeof vehicle.shippingDaysToAlpine === 'number') {
    return vehicle.shippingDaysToAlpine;
  }

  return calculateDaysBetween(vehicle.shippedFromMevaDate, vehicle.arrivedAtAlpineDate);
}

export function getVehiclePhase(vehicle: ProductionVehicle) {
  const phase = getJourneyPhase(vehicle);
  const styles: Record<JourneyPhase, string> = {
    Scheduled: 'border-slate-300 bg-white/95 text-slate-800',
    'Transit to MEVA': 'border-blue-200 bg-blue-50/95 text-blue-800',
    'At MEVA / Production Cycle': 'border-sky-200 bg-sky-50/95 text-sky-800',
    'Transit to Alpine': 'border-indigo-200 bg-indigo-50/95 text-indigo-800',
    Received: 'border-emerald-200 bg-emerald-50/95 text-emerald-800',
  };

  return {
    label: phase,
    className: styles[phase],
  };
}

export function isActiveProductionStatus(status: ProductionStatus) {
  return status === 'In Production';
}

export function isAtMevaStatus(status: ProductionStatus) {
  return STATUS_TO_PHASE_MAP[status] === 'At MEVA / Production Cycle';
}

export function isTransitToMevaStatus(status: ProductionStatus) {
  return status === 'Shipped to MEVA';
}

export function isInTransitStatus(status: ProductionStatus) {
  return status === 'Shipped to MEVA' || status === 'Shipped to Alpine';
}

export function isProductionCompleteStatus(status: ProductionStatus) {
  return status === 'Ready for Shipment' || status === 'Shipped to Alpine' || status === 'Received';
}

export function calculateDaysBetween(start?: string | Date, end?: string | Date) {
  if (!start || !end) {
    return undefined;
  }

  const startDate = start instanceof Date ? start : new Date(start);
  const endDate = end instanceof Date ? end : new Date(end);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return undefined;
  }

  return Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000));
}

function getMevaExitDate(vehicle: ProductionVehicle) {
  return vehicle.shippedFromMevaDate || vehicle.arrivedAtAlpineDate;
}

function formatFieldValue(vehicle: ProductionVehicle, key: keyof ProductionVehicle) {
  const value = vehicle[key];

  if (value === undefined || value === null || value === '') {
    return '-';
  }

  if (typeof value === 'number') {
    if (key === 'daysAtMeva' || key === 'daysMevaTookToFinish' || key === 'shippingDaysToMeva' || key === 'shippingDaysToAlpine') {
      return `${value.toLocaleString()} day${value === 1 ? '' : 's'}`;
    }

    if (key === 'scheduleVarianceDays') {
      if (value > 0) {
        return `${value}d late`;
      }

      if (value < 0) {
        return `${Math.abs(value)}d early`;
      }

      return 'On time';
    }

    return value.toLocaleString();
  }

  if (isDateField(key)) {
    return formatTimelineDate(String(value));
  }

  return String(value);
}

function isDateField(key: keyof ProductionVehicle) {
  return key.endsWith('Date') || key === 'blockerStartedAt' || key === 'blockerResolvedAt';
}

function formatTimelineDate(value?: string) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}
