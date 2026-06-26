export type ProductionStatus =
  | 'Scheduled'
  | 'Shipped to MEVA'
  | 'Design Confirmation Pending'
  | 'In Production'
  | 'Final Stages of Production'
  | 'Ready for Shipment'
  | 'Shipped to Alpine'
  | 'Received';

export type OperationalRisk = 'On Time' | 'Watch' | 'Late' | 'Done';
export type UserRole = 'MEVA' | 'ALPINE' | 'GUEST';
export type ProductionSubStatus = 'Running' | 'Blocked' | 'On Hold';
export type ProductionBlockerType =
  | 'Design Confirmation Pending'
  | 'Material Pending'
  | 'Quality Hold'
  | 'Client Confirmation Pending'
  | 'Other';
export type ProductionBlockerStatus = 'Open' | 'Resolved';
export type DisputeStatus =
  | 'Opened by Alpine'
  | 'MEVA Reviewing'
  | 'MEVA Responded'
  | 'Alpine Accepted'
  | 'Escalated'
  | 'Resolved';

export interface RawAirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

export interface ProductionBlocker {
  type: ProductionBlockerType;
  status: ProductionBlockerStatus;
  subStatus?: ProductionSubStatus;
  startedAt?: string;
  resolvedAt?: string;
  days?: number;
}

export interface ProductionVehicle {
  id: string;
  vehicleNumber: string;
  vehicle?: string;
  designStyle?: string;
  modelYear?: number;
  vin?: string;
  armoringLevel?: string;
  facility?: string;
  productionStatus: ProductionStatus;
  productionSubStatus?: ProductionSubStatus;
  blockerType?: ProductionBlockerType;
  blockerStatus?: ProductionBlockerStatus;
  blockerStartedAt?: string;
  blockerResolvedAt?: string;
  blockerDays?: number;
  chassisShippedFromAlpineDate?: string;
  chassisArrivalExpectedDate?: string;
  chassisArrivalActualDate?: string;
  designChangeRequestedDate?: string;
  designChangeCompletedDate?: string;
  designApprovedDate?: string;
  actualProductionTime?: string;
  expectedCompletionDate?: string;
  actualProductionCompletionDate?: string;
  actualCompletionDate?: string;
  shippedFromMevaDate?: string;
  arrivedAtAlpineDate?: string;
  shippingDaysToMeva?: number;
  shippingDaysToAlpine?: number;
  daysAtMeva?: number;
  daysMevaTookToFinish?: number;
  scheduleVarianceDays?: number;
  mevaNotes?: string;
  notes?: string;
  currentStatus?: string;
  alpineAssessment?: string;
  risk: OperationalRisk;
}

export interface AppSession {
  username: string;
  role: UserRole;
  organization: 'MEVA' | 'Alpine' | 'Guest';
  displayName: string;
}

export interface RolePermissions {
  canEditProduction: boolean;
  canViewInternalNotes: boolean;
  canOpenDisputes: boolean;
  canRespondToDisputes: boolean;
  canResolveDisputes: boolean;
  canViewDisputes: boolean;
}

export interface VehicleDispute {
  id: string;
  vehicleId: string;
  vehicleNumber: string;
  disputeType: string;
  disputedField: string;
  alpineClaim: string;
  mevaResponse?: string;
  status: DisputeStatus;
  openedBy: string;
  openedByRole: UserRole;
  openedByOrg: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

export interface ProductionSummary {
  totalOrdered: number;
  atMevaProductionCycle: number;
  activeProduction: number;
  inTransit: number;
  completed: number;
  chassisOnTheWay: number;
  readyForShipment: number;
  received: number;
  blockedProduction: number;
  delayedAtRisk: number;
  delayed: number;
  watchList: number;
  averageDaysAtMeva: number;
}

export interface VehiclesResponse {
  data: ProductionVehicle[];
  summary: ProductionSummary;
  updatedAt: string;
  session: AppSession;
  permissions: RolePermissions;
}
