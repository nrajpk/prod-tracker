'use client';

import Image from 'next/image';
import { FormEvent, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  TooltipLabel,
  VehicleDelayAlert,
  VehicleImagePhaseBadge,
  VehicleProgressChip,
  VehicleProgressMini,
  VehicleTimeline,
} from '@/components/VehicleTimeline';
import {
  PHASE_ORDER,
  STAGE_ORDER,
  getDaysAtMEVA,
  getDelaySummary,
  getJourneyPhase,
  getStatusesForPhase,
  getVehicleHealth,
  getVehicleProgress,
  getWorkflowStatus,
  matchesDashboardBucket,
  type DashboardBucketKey,
  type JourneyPhase,
} from '@/lib/vehicleTimeline';
import {
  canObjectToField,
  canEditField,
  getFieldOwner,
  getFieldTooltip as getFieldHelp,
  type FieldKey,
} from '@/lib/fieldPermissions';
import type {
  AppSession,
  FieldObjection,
  FieldObjectionStatus,
  OperationalRisk,
  ProductionStatus,
  ProductionVehicle,
  RolePermissions,
  VehicleDispute,
  VehiclesResponse,
} from '@/lib/types';

const statusOrder = STAGE_ORDER;
const SHOW_WORKFLOW_BOARD = false;

const detailUpdateFields = [
  { key: 'vehicleNumber', label: 'Vehicle #', kind: 'text' },
  { key: 'vehicle', label: 'Vehicle', kind: 'text' },
  { key: 'designStyle', label: 'Build / Design', kind: 'text' },
  { key: 'modelYear', label: 'Model Year', kind: 'text' },
  { key: 'vin', label: 'VIN', kind: 'text' },
  { key: 'armoringLevel', label: 'Armouring Level', kind: 'text' },
  { key: 'chassisShippedFromAlpineDate', label: 'Chassis shipped from Alpine', kind: 'date' },
  { key: 'designChangeRequestedDate', label: 'Design change requested', kind: 'date' },
  { key: 'designChangeCompletedDate', label: 'Design change / confirmation time', kind: 'date' },
  { key: 'designApprovedDate', label: 'Design approval', kind: 'date' },
  { key: 'productionStatus', label: 'Stage', kind: 'status' },
  { key: 'expectedCompletionDate', label: 'Expected completion', kind: 'date' },
  { key: 'actualProductionCompletionDate', label: 'Production completed', kind: 'date' },
  { key: 'actualCompletionDate', label: 'Final completion', kind: 'date' },
  { key: 'shippedFromMevaDate', label: 'Shipped from MEVA', kind: 'date' },
  { key: 'arrivedAtAlpineDate', label: 'Arrived at Alpine', kind: 'date' },
  { key: 'currentStatus', label: 'Current status', kind: 'text' },
  { key: 'notes', label: 'Latest note', kind: 'textarea' },
  { key: 'alpineAssessment', label: 'Alpine assessment', kind: 'textarea' },
  { key: 'mevaNotes', label: 'Private MEVA notes', kind: 'textarea' },
] as const satisfies ReadonlyArray<{ key: FieldKey; label: string; kind: 'date' | 'status' | 'text' | 'textarea' }>;

const inlineUpdateFields = [
  { key: 'productionStatus', label: 'Stage', kind: 'status' },
  { key: 'expectedCompletionDate', label: 'Planned', kind: 'date' },
  { key: 'actualCompletionDate', label: 'Actual', kind: 'date' },
  { key: 'notes', label: 'Latest note', kind: 'text' },
] as const satisfies ReadonlyArray<{ key: FieldKey; label: string; kind: 'date' | 'status' | 'text' }>;

type DetailUpdateKey = (typeof detailUpdateFields)[number]['key'];
type InlineUpdateKey = (typeof inlineUpdateFields)[number]['key'];

const riskStyles: Record<OperationalRisk, string> = {
  'On Time': 'border-emerald-200 bg-emerald-50 text-emerald-800',
  Watch: 'border-amber-200 bg-amber-50 text-amber-800',
  Late: 'border-red-200 bg-red-50 text-red-800',
  Done: 'border-slate-200 bg-slate-100 text-slate-700',
};

const statusStyles: Record<ProductionStatus, string> = {
  Scheduled: 'bg-slate-100 text-slate-700',
  'Shipped to MEVA': 'bg-blue-100 text-blue-800',
  'In Production': 'bg-sky-100 text-sky-800',
  'Design Confirmation Pending': 'bg-violet-100 text-violet-800',
  'Final Stages of Production': 'bg-indigo-100 text-indigo-800',
  'Ready for Shipment': 'bg-emerald-100 text-emerald-800',
  'Shipped to Alpine': 'bg-stone-100 text-stone-800',
  Received: 'bg-zinc-100 text-zinc-800',
};

const disputeStatusStyles: Record<VehicleDispute['status'], string> = {
  'Opened by Alpine': 'bg-red-50 text-red-700 border-red-200',
  'MEVA Reviewing': 'bg-amber-50 text-amber-700 border-amber-200',
  'MEVA Responded': 'bg-sky-50 text-sky-700 border-sky-200',
  'Alpine Accepted': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Escalated: 'bg-violet-50 text-violet-700 border-violet-200',
  Resolved: 'bg-slate-100 text-slate-700 border-slate-200',
};

const issueStatusLabels: Record<VehicleDispute['status'], string> = {
  'Opened by Alpine': 'New',
  'MEVA Reviewing': 'Checking',
  'MEVA Responded': 'Answered',
  'Alpine Accepted': 'Accepted',
  Escalated: 'Escalated',
  Resolved: 'Closed',
};

const fieldObjectionStatusStyles: Record<FieldObjectionStatus, string> = {
  Open: 'border-red-200 bg-red-50 text-red-700',
  Reviewed: 'border-amber-200 bg-amber-50 text-amber-700',
  Accepted: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  Rejected: 'border-slate-200 bg-slate-100 text-slate-700',
  Resolved: 'border-slate-200 bg-slate-100 text-slate-500',
};

const fetchVehicles = async (): Promise<VehiclesResponse> => {
  const res = await fetch('/api/vehicles');

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string; detail?: string } | null;
    throw new Error(body?.detail || body?.error || `Vehicle data failed with status ${res.status}`);
  }

  return res.json();
};

const fetchDisputes = async (): Promise<{ data: VehicleDispute[] }> => {
  const res = await fetch('/api/disputes');

  if (!res.ok) {
    throw new Error('Could not load disputes');
  }

  return res.json();
};

const fetchFieldObjections = async (): Promise<{ data: FieldObjection[] }> => {
  const res = await fetch('/api/field-objections');

  if (!res.ok) {
    throw new Error('Could not load field objections');
  }

  return res.json();
};

type BriefKey = DashboardBucketKey | ProductionStatus;

const briefCopy: Record<BriefKey, { title: string; detail: string }> = {
  orders: {
    title: 'Total Orders',
    detail: 'All vehicles in this job',
  },
  atMeva: {
    title: 'At MEVA / Production Cycle',
    detail: 'Design confirmation, build, final stages, or ready for shipment',
  },
  activeProduction: {
    title: 'Active Production',
    detail: 'Only vehicles in the In Production workflow stage',
  },
  inTransit: {
    title: 'In Transit',
    detail: 'Vehicles moving to MEVA or back to Alpine',
  },
  delayedAtRisk: {
    title: 'Delayed / At Risk',
    detail: 'Vehicles marked Late or Watch',
  },
  received: {
    title: 'Received',
    detail: 'Vehicles received by Alpine',
  },
  Scheduled: {
    title: 'Scheduled',
    detail: 'Planned but not yet shipped to MEVA',
  },
  'Shipped to MEVA': {
    title: 'Shipped to MEVA',
    detail: 'On the way to MEVA',
  },
  'In Production': {
    title: 'In Production',
    detail: 'Build work is in progress',
  },
  'Design Confirmation Pending': {
    title: 'Design Confirmation Pending',
    detail: 'Waiting for design confirmation',
  },
  'Final Stages of Production': {
    title: 'Final Stages of Production',
    detail: 'Near completion',
  },
  'Ready for Shipment': {
    title: 'Ready for Shipment',
    detail: 'Ready to leave MEVA',
  },
  'Shipped to Alpine': {
    title: 'Shipped to Alpine',
    detail: 'Left MEVA for Alpine',
  },
  Received: {
    title: 'Received',
    detail: 'Received by Alpine',
  },
};

type ResultView = 'table' | 'cards';
type DetailDrawerMode = 'status' | 'edit';

const vehicleImageCatalog: Record<string, { key: string; label: string }> = {
  'VALOR PLUS': { key: 'valor-plus', label: 'MEVA Valor Plus' },
  'MEVA VALOR PLUS': { key: 'valor-plus', label: 'MEVA Valor Plus' },
  MAXIMUS: { key: 'maximus', label: 'MEVA Maximus' },
  'MEVA MAXIMUS': { key: 'maximus', label: 'MEVA Maximus' },
  VALOR: { key: 'valor', label: 'MEVA Valor' },
  'MEVA VALOR': { key: 'valor', label: 'MEVA Valor' },
  LYNX: { key: 'lynx', label: 'MEVA Lynx' },
  'MEVA LYNX': { key: 'lynx', label: 'MEVA Lynx' },
  DELTA: { key: 'delta', label: 'MEVA Delta' },
  'MEVA DELTA': { key: 'delta', label: 'MEVA Delta' },
  'DELTA-T': { key: 'delta-t', label: 'MEVA Delta-T' },
  'MEVA DELTA-T': { key: 'delta-t', label: 'MEVA Delta-T' },
  BETA: { key: 'beta', label: 'MEVA Beta' },
  'MEVA BETA': { key: 'beta', label: 'MEVA Beta' },
};

function normalizeBuildName(value?: string) {
  return value?.trim().replace(/\s+/g, ' ').toUpperCase();
}

function isBuildName(value: string | undefined): value is string {
  return Boolean(value);
}

function getVehicleImage(vehicle: ProductionVehicle) {
  const match = [vehicle.designStyle, vehicle.vehicle]
    .map(normalizeBuildName)
    .filter(isBuildName)
    .map((name) => vehicleImageCatalog[name])
    .find(Boolean);

  if (!match) {
    return null;
  }

  return {
    src: `/images/alpine/${match.key}.png`,
    label: match.label,
  };
}

function getVehicleDraftValue(vehicle: ProductionVehicle, key: FieldKey) {
  const value = vehicle[key as keyof ProductionVehicle];
  return value === undefined || value === null ? '' : String(value);
}

function getOwnerLabel(key: FieldKey) {
  const owner = getFieldOwner(key);

  if (owner === 'ALPINE') {
    return 'Managed by Alpine';
  }

  if (owner === 'MEVA') {
    return 'Managed by MEVA';
  }

  if (owner === 'SYSTEM') {
    return 'Calculated';
  }

  return 'Shared ownership';
}

function fieldInputClass(canEdit: boolean, hasActiveObjection = false) {
  if (hasActiveObjection) {
    return 'mt-1 min-h-10 w-full rounded-md border border-red-300 bg-red-50 px-3 text-sm font-medium normal-case text-red-900';
  }

  return `mt-1 min-h-10 w-full rounded-md border px-3 text-sm font-medium normal-case ${
    canEdit
      ? 'border-slate-300 bg-white text-slate-800'
      : 'border-slate-200 bg-slate-50 text-slate-500'
  }`;
}

function getBriefVehicles(
  briefKey: BriefKey,
  vehicles: ProductionVehicle[],
) {
  if (
    briefKey === 'orders' ||
    briefKey === 'atMeva' ||
    briefKey === 'activeProduction' ||
    briefKey === 'inTransit' ||
    briefKey === 'delayedAtRisk' ||
    briefKey === 'received'
  ) {
    return vehicles.filter((vehicle) => matchesDashboardBucket(vehicle, briefKey));
  }

  return vehicles.filter((vehicle) => getWorkflowStatus(vehicle) === briefKey);
}

function sortBriefVehicles(briefKey: BriefKey, vehicles: ProductionVehicle[]) {
  return [...vehicles].sort((a, b) => {
    if (briefKey !== 'orders') {
      return dateValue(a.expectedCompletionDate) - dateValue(b.expectedCompletionDate);
    }

    return a.vehicleNumber.localeCompare(b.vehicleNumber, undefined, { numeric: true });
  });
}

function dateValue(value?: string) {
  if (!value) {
    return Number.MAX_SAFE_INTEGER;
  }

  const date = new Date(value).getTime();
  return Number.isNaN(date) ? Number.MAX_SAFE_INTEGER : date;
}

export default function DashboardGrid({ session }: { session: AppSession }) {
  const queryClient = useQueryClient();
  const [facilityFilter, setFacilityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<ProductionStatus | 'ALL'>('ALL');
  const [riskFilter, setRiskFilter] = useState<OperationalRisk | 'ALL'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState<ProductionVehicle | null>(null);
  const [activeBrief, setActiveBrief] = useState<BriefKey | null>(null);
  const [resultView, setResultView] = useState<ResultView>('cards');

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['production-vehicles'],
    queryFn: fetchVehicles,
    staleTime: 1000 * 60,
  });

  const disputesQuery = useQuery({
    queryKey: ['vehicle-disputes'],
    queryFn: fetchDisputes,
    enabled: session.role !== 'GUEST',
    staleTime: 1000 * 30,
  });
  const fieldObjectionsQuery = useQuery({
    queryKey: ['field-objections'],
    queryFn: fetchFieldObjections,
    enabled: session.role !== 'GUEST',
    staleTime: 1000 * 30,
  });

  const vehicles = useMemo(() => data?.data ?? [], [data?.data]);
  const permissions = data?.permissions;
  const disputes = disputesQuery.data?.data ?? [];
  const fieldObjections = fieldObjectionsQuery.data?.data ?? [];
  const actionableFieldObjections = fieldObjections.filter(
    (objection) => objection.responsibleRole === session.role && objection.status !== 'Resolved',
  );
  const facilities = useMemo(
    () => Array.from(new Set(vehicles.map((vehicle) => vehicle.facility).filter(Boolean))).sort(),
    [vehicles],
  );

  const filteredVehicles = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return vehicles.filter((vehicle) => {
      const matchesFacility = facilityFilter === 'ALL' || vehicle.facility === facilityFilter;
      const matchesStatus = statusFilter === 'ALL' || getWorkflowStatus(vehicle) === statusFilter;
      const matchesRisk = riskFilter === 'ALL' || getVehicleHealth(vehicle) === riskFilter;
      const matchesSearch =
        !normalizedSearch ||
        [vehicle.vehicleNumber, vehicle.vehicle, vehicle.vin, vehicle.designStyle, vehicle.currentStatus]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(normalizedSearch));

      return matchesFacility && matchesStatus && matchesRisk && matchesSearch;
    });
  }, [facilityFilter, riskFilter, searchTerm, statusFilter, vehicles]);

  const pipeline = useMemo(
    () =>
      statusOrder
        .map((status) => ({
          status,
          vehicles: filteredVehicles.filter((vehicle) => getWorkflowStatus(vehicle) === status),
        })),
    [filteredVehicles],
  );

  const openDisputes = disputes.filter((dispute) => dispute.status !== 'Resolved');
  const stageCounts = useMemo(
    () =>
      statusOrder.reduce<Record<ProductionStatus, number>>((counts, status) => {
        counts[status] = vehicles.filter((vehicle) => getWorkflowStatus(vehicle) === status).length;
        return counts;
      }, {} as Record<ProductionStatus, number>),
    [vehicles],
  );
  const phaseCounts = useMemo(
    () =>
      PHASE_ORDER.reduce<Record<JourneyPhase, number>>((counts, phase) => {
        counts[phase] = vehicles.filter((vehicle) => getJourneyPhase(vehicle) === phase).length;
        return counts;
      }, {} as Record<JourneyPhase, number>),
    [vehicles],
  );
  const activeBriefVehicles = activeBrief ? getBriefVehicles(activeBrief, vehicles) : [];
  const activeBriefIssueMap = useMemo(() => {
    const map = new Map<string, VehicleDispute[]>();

    for (const dispute of openDisputes) {
      const existing = map.get(dispute.vehicleId) || [];
      map.set(dispute.vehicleId, [...existing, dispute]);
    }

    return map;
  }, [openDisputes]);

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-lg border border-slate-200 bg-white" />
        ))}
      </div>
    );
  }

  if (isError || !data || !permissions) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        <div className="font-semibold">Could not load vehicle data.</div>
        <div className="mt-2">{error instanceof Error ? error.message : 'Please check the deployment settings.'}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <RoleBanner session={session} permissions={permissions} />
      {actionableFieldObjections.length > 0 && (
        <FieldObjectionNotifications
          objections={actionableFieldObjections}
          vehicles={vehicles}
          onSelectVehicle={setSelectedVehicle}
          onRefresh={() => queryClient.invalidateQueries({ queryKey: ['field-objections'] })}
        />
      )}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        <MetricCard
          label="Total Orders"
          value={data.summary.totalOrdered}
          detail="All vehicles"
          active={activeBrief === 'orders'}
          onClick={() => setActiveBrief('orders')}
        />
        <MetricCard
          label="At MEVA / Production Cycle"
          value={data.summary.atMevaProductionCycle}
          detail="Design, build, final, or ready"
          active={activeBrief === 'atMeva'}
          onClick={() => setActiveBrief('atMeva')}
        />
        <MetricCard
          label="Active Production"
          value={data.summary.activeProduction}
          detail="In Production only"
          active={activeBrief === 'activeProduction'}
          onClick={() => setActiveBrief('activeProduction')}
        />
        <MetricCard
          label="In Transit"
          value={data.summary.inTransit}
          detail="To MEVA or to Alpine"
          active={activeBrief === 'inTransit'}
          onClick={() => setActiveBrief('inTransit')}
        />
        <MetricCard
          label="Delayed / At Risk"
          value={data.summary.delayedAtRisk}
          detail="Late or Watch health"
          active={activeBrief === 'delayedAtRisk'}
          onClick={() => setActiveBrief('delayedAtRisk')}
          tone={data.summary.delayedAtRisk > 0 ? 'warn' : 'neutral'}
        />
        <MetricCard
          label="Received"
          value={data.summary.received}
          detail="Received by Alpine"
          active={activeBrief === 'received'}
          onClick={() => setActiveBrief('received')}
        />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-3">
          <h2 className="text-base font-semibold text-slate-950">Journey Phases</h2>
          <p className="text-sm text-slate-500">Main movement view, with MEVA production broken into workflow stages.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {PHASE_ORDER.map((phase) => (
            <PhaseMetricCard
              key={phase}
              phase={phase}
              value={phaseCounts[phase] || 0}
              stageCounts={stageCounts}
              activeBrief={activeBrief}
              onOpen={setActiveBrief}
            />
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="grid gap-3 border-b border-slate-200 p-4 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <input
            className="min-h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
            placeholder="Search vehicle, VIN, design, or note"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
          <select
            className="min-h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
            value={facilityFilter}
            onChange={(event) => setFacilityFilter(event.target.value)}
          >
            <option value="ALL">All locations</option>
            {facilities.map((facility) => (
              <option key={facility} value={facility}>
                {facility}
              </option>
            ))}
          </select>
          <select
            className="min-h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as ProductionStatus | 'ALL')}
          >
            <option value="ALL">All stages</option>
            {statusOrder.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <select
            className="min-h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
            value={riskFilter}
            onChange={(event) => setRiskFilter(event.target.value as OperationalRisk | 'ALL')}
          >
            <option value="ALL">All health</option>
            <option value="On Time">On Time</option>
            <option value="Watch">Watch</option>
            <option value="Late">Late</option>
            <option value="Done">Done</option>
          </select>
        </div>

        {SHOW_WORKFLOW_BOARD && (
          <div className="border-b border-slate-200 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-950">Workflow Status Board</h2>
                <p className="text-sm text-slate-500">
                  Eight workflow statuses, shown in journey order. Showing {filteredVehicles.length} of {vehicles.length} vehicles.
                </p>
              </div>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                Updated {formatDateTime(data.updatedAt)}
              </span>
            </div>

            <div className="overflow-x-auto">
              <div className="grid min-w-[1680px] grid-cols-8 gap-3">
                {pipeline.map(({ status, vehicles: statusVehicles }) => (
                  <div key={status} className="min-h-72 rounded-lg border border-slate-200 bg-slate-50">
                    <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
                      <span className="text-xs font-semibold uppercase text-slate-600">{status}</span>
                      <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-700">
                        {statusVehicles.length}
                      </span>
                    </div>
                    <div className="space-y-2 p-2">
                      {statusVehicles.slice(0, 4).map((vehicle) => (
                        <WorkflowBoardVehicleCard
                          key={vehicle.id}
                          vehicle={vehicle}
                          onOpen={setSelectedVehicle}
                        />
                      ))}
                      {statusVehicles.length > 4 && (
                        <div className="px-2 py-1 text-xs font-medium text-slate-500">
                          +{statusVehicles.length - 4} more
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {permissions.canViewDisputes && (
          <DisputeCenter
            disputes={openDisputes}
            vehicles={vehicles}
            onSelectVehicle={setSelectedVehicle}
          />
        )}

        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950">Vehicle List</h2>
            <p className="text-sm text-slate-500">{filteredVehicles.length} vehicles match the current filters</p>
          </div>
          <div className="inline-flex rounded-md border border-slate-300 bg-slate-50 p-1">
            <button
              className={`min-h-9 rounded px-4 text-sm font-semibold ${
                resultView === 'cards' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
              onClick={() => setResultView('cards')}
              type="button"
            >
              Cards
            </button>
            <button
              className={`min-h-9 rounded px-4 text-sm font-semibold ${
                resultView === 'table' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
              onClick={() => setResultView('table')}
              type="button"
            >
              Table
            </button>
          </div>
        </div>

        {resultView === 'table' ? (
          <MasterTable
            vehicles={filteredVehicles}
            onSelectVehicle={setSelectedVehicle}
          />
        ) : (
          <VehicleCardGrid
            vehicles={filteredVehicles}
            disputes={disputes}
            onSelectVehicle={setSelectedVehicle}
          />
        )}
      </section>

      {selectedVehicle && (
        <VehicleDetailPanel
          key={selectedVehicle.id}
          vehicle={selectedVehicle}
          permissions={permissions}
          session={session}
          disputes={disputes.filter((dispute) => dispute.vehicleId === selectedVehicle.id)}
          fieldObjections={fieldObjections.filter((objection) => objection.vehicleId === selectedVehicle.id)}
          onClose={() => setSelectedVehicle(null)}
          onRefresh={() => {
            queryClient.invalidateQueries({ queryKey: ['production-vehicles'] });
            queryClient.invalidateQueries({ queryKey: ['vehicle-disputes'] });
            queryClient.invalidateQueries({ queryKey: ['field-objections'] });
          }}
        />
      )}

      {activeBrief && (
        <BriefDrawer
          briefKey={activeBrief}
          vehicles={activeBriefVehicles}
          issueMap={activeBriefIssueMap}
          session={session}
          onClose={() => setActiveBrief(null)}
          onOpenVehicle={(vehicle) => setSelectedVehicle(vehicle)}
          onRefresh={() => {
            queryClient.invalidateQueries({ queryKey: ['production-vehicles'] });
            queryClient.invalidateQueries({ queryKey: ['vehicle-disputes'] });
          }}
        />
      )}
    </div>
  );
}

function RoleBanner({ session, permissions }: { session: AppSession; permissions: RolePermissions }) {
  const description =
    session.role === 'MEVA'
      ? 'You can update MEVA-managed production fields and answer issues.'
      : session.role === 'ALPINE'
        ? 'You can update Alpine-managed movement and receipt fields, and raise issues when needed.'
        : 'You can view the tracker only.';

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Signed in as {session.organization}
          </div>
          <p className="mt-1 text-sm text-slate-700">{description}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-semibold">
          <PermissionPill active={session.role === 'MEVA'} label="MEVA field editor" />
          <PermissionPill active={session.role === 'ALPINE'} label="Alpine field editor" />
          <PermissionPill active={permissions.canOpenDisputes} label="Can raise issues" />
          <PermissionPill active={permissions.canRespondToDisputes} label="Can answer issues" />
          <PermissionPill active={permissions.canViewInternalNotes} label="Can see MEVA notes" />
        </div>
      </div>
    </section>
  );
}

function FieldObjectionNotifications({
  objections,
  vehicles,
  onSelectVehicle,
  onRefresh,
}: {
  objections: FieldObjection[];
  vehicles: ProductionVehicle[];
  onSelectVehicle: (vehicle: ProductionVehicle) => void;
  onRefresh: () => void;
}) {
  const [savingId, setSavingId] = useState('');
  const visibleObjections = objections.slice(0, 4);

  async function updateStatus(objection: FieldObjection, status: FieldObjectionStatus) {
    setSavingId(objection.id);

    const response = await fetch(`/api/field-objections/${objection.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });

    setSavingId('');

    if (response.ok) {
      onRefresh();
    }
  }

  return (
    <section className="rounded-lg border border-red-200 bg-red-50 p-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-red-900">Field objections need your response</h2>
          <p className="text-sm text-red-700">
            {objections.length} active objection{objections.length === 1 ? '' : 's'} assigned to your team.
          </p>
        </div>
        <span className="rounded-full border border-red-200 bg-white px-3 py-1 text-xs font-semibold text-red-700">
          Notified
        </span>
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        {visibleObjections.map((objection) => {
          const vehicle = vehicles.find((item) => item.id === objection.vehicleId);

          return (
            <div key={objection.id} className="rounded-md border border-red-200 bg-white p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-950">
                    {vehicle?.vehicleNumber || objection.vehicleId} / {objection.fieldLabel}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{objection.reason}</div>
                </div>
                <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${fieldObjectionStatusStyles[objection.status]}`}>
                  {objection.status}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {vehicle && (
                  <button
                    className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700"
                    onClick={() => onSelectVehicle(vehicle)}
                    type="button"
                  >
                    Open vehicle
                  </button>
                )}
                {(['Reviewed', 'Accepted', 'Rejected', 'Resolved'] as FieldObjectionStatus[]).map((status) => (
                  <button
                    key={status}
                    className="rounded-md border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-50"
                    disabled={savingId === objection.id}
                    onClick={() => updateStatus(objection, status)}
                    type="button"
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PermissionPill({ active, label }: { active: boolean; label: string }) {
  return (
    <span className={`rounded-full border px-3 py-1 ${active ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-400'}`}>
      {label}
    </span>
  );
}

function MetricCard({
  label,
  value,
  detail,
  tone = 'neutral',
  active,
  onClick,
}: {
  label: string;
  value: number;
  detail: string;
  tone?: 'neutral' | 'danger' | 'warn';
  active: boolean;
  onClick: () => void;
}) {
  const toneClass =
    tone === 'danger'
      ? 'border-red-200 bg-red-50 text-red-700'
      : tone === 'warn'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : 'border-slate-200 bg-white text-slate-950';
  const activeClass = active ? 'ring-2 ring-slate-950 ring-offset-2' : 'hover:border-slate-400 hover:shadow-sm';

  return (
    <button
      type="button"
      className={`rounded-lg border p-4 text-left transition ${toneClass} ${activeClass}`}
      onClick={onClick}
    >
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
      <div className="mt-1 text-sm text-slate-500">{detail}</div>
      <div className="mt-3 text-xs font-semibold text-slate-600">Click to view</div>
    </button>
  );
}

function PhaseMetricCard({
  phase,
  value,
  stageCounts,
  activeBrief,
  onOpen,
}: {
  phase: JourneyPhase;
  value: number;
  stageCounts: Record<ProductionStatus, number>;
  activeBrief: BriefKey | null;
  onOpen: (briefKey: BriefKey) => void;
}) {
  const statuses = getStatusesForPhase(phase);
  const briefKey = getPhaseBriefKey(phase, statuses);
  const active = activeBrief === briefKey;
  const activeClass = active ? 'ring-2 ring-slate-950 ring-offset-2' : 'hover:border-slate-400 hover:bg-white';

  return (
    <button
      type="button"
      className={`min-h-36 rounded-lg border border-slate-200 bg-slate-50 p-3 text-left transition ${activeClass}`}
      onClick={() => onOpen(briefKey)}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-semibold uppercase leading-4 text-slate-500">{phase}</span>
        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-700">
          {value}
        </span>
      </div>
      <div className="mt-3 space-y-1">
        {statuses.map((status) => (
          <div key={status} className="flex items-center justify-between gap-2 text-xs">
            <span className={`rounded-full px-2 py-0.5 font-semibold ${statusStyles[status]}`}>{status}</span>
            <span className="font-semibold text-slate-700">{stageCounts[status] || 0}</span>
          </div>
        ))}
      </div>
    </button>
  );
}

function getPhaseBriefKey(phase: JourneyPhase, statuses: ProductionStatus[]): BriefKey {
  if (phase === 'At MEVA / Production Cycle') {
    return 'atMeva';
  }

  if (phase === 'Received') {
    return 'received';
  }

  return statuses[0] || 'orders';
}

function BriefDrawer({
  briefKey,
  vehicles,
  issueMap,
  session,
  onClose,
  onOpenVehicle,
  onRefresh,
}: {
  briefKey: BriefKey;
  vehicles: ProductionVehicle[];
  issueMap: Map<string, VehicleDispute[]>;
  session: AppSession;
  onClose: () => void;
  onOpenVehicle: (vehicle: ProductionVehicle) => void;
  onRefresh: () => void;
}) {
  const sortedVehicles = sortBriefVehicles(briefKey, vehicles);
  const openIssueCount = sortedVehicles.reduce((total, vehicle) => total + (issueMap.get(vehicle.id)?.length || 0), 0);
  const copy = briefCopy[briefKey];
  const canUseQuickEdit = inlineUpdateFields.some((field) => canEditField(session.role, field.key));

  return (
    <div className="fixed inset-0 z-40 bg-slate-950/25">
      <div className="ml-auto flex h-full w-full max-w-4xl flex-col bg-white shadow-2xl">
        <div className="border-b border-slate-200 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Quick view</div>
              <h2 className="mt-1 text-2xl font-semibold text-slate-950">{copy.title}</h2>
              <p className="mt-1 text-sm text-slate-600">{copy.detail}</p>
            </div>
            <button
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-slate-500"
              onClick={onClose}
              type="button"
            >
              Close
            </button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700">
              {sortedVehicles.length} vehicles
            </span>
            {openIssueCount > 0 && (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-700">
                {openIssueCount} open issues
              </span>
            )}
            {canUseQuickEdit ? (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">
                Edit here
              </span>
            ) : (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-500">
                View only here
              </span>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-50 p-4">
          {sortedVehicles.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">
              Nothing to show for this card.
            </div>
          ) : (
            <div className="space-y-3">
              {sortedVehicles.map((vehicle) => (
                <BriefVehicleRow
                  key={vehicle.id}
                  vehicle={vehicle}
                  issues={issueMap.get(vehicle.id) || []}
                  userRole={session.role}
                  onOpenVehicle={onOpenVehicle}
                  onRefresh={onRefresh}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BriefVehicleRow({
  vehicle,
  issues,
  userRole,
  onOpenVehicle,
  onRefresh,
}: {
  vehicle: ProductionVehicle;
  issues: VehicleDispute[];
  userRole: AppSession['role'];
  onOpenVehicle: (vehicle: ProductionVehicle) => void;
  onRefresh: () => void;
}) {
  const [draft, setDraft] = useState<Record<InlineUpdateKey, string>>(() =>
    inlineUpdateFields.reduce(
      (values, field) => ({
        ...values,
        [field.key]: getVehicleDraftValue(vehicle, field.key),
      }),
      {} as Record<InlineUpdateKey, string>,
    ),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const editableInlineFields = inlineUpdateFields.filter((field) => canEditField(userRole, field.key));

  async function saveInlineUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setMessage('');

    const response = await fetch(`/api/vehicles/${vehicle.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        Object.fromEntries(
          editableInlineFields
            .map((field) => [field.key, draft[field.key]]),
        ),
      ),
    });

    setIsSaving(false);

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setMessage(body?.error || 'Could not save');
      return;
    }

    setMessage('Saved');
    onRefresh();
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-slate-950">{vehicle.vehicleNumber}</h3>
            <VehicleProgressChip vehicle={vehicle} />
            <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${riskStyles[vehicle.risk]}`}>
              {vehicle.risk}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {[vehicle.designStyle || vehicle.vehicle, vehicle.modelYear, vehicle.armoringLevel].filter(Boolean).join(' / ') ||
              'Build details not set'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {vehicle.facility || 'No location'} - Planned {formatDate(vehicle.expectedCompletionDate)} - Actual{' '}
            {formatDate(vehicle.actualCompletionDate)}
          </p>
          <div className="mt-3">
            <VehicleProgressMini vehicle={vehicle} />
          </div>
        </div>
        <button
          className="min-h-9 rounded-md border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:border-slate-500"
          onClick={() => onOpenVehicle(vehicle)}
          type="button"
        >
          Open full details
        </button>
      </div>

      {issues.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {issues.map((issue) => (
            <span
              key={issue.id}
              className={`rounded-full border px-2 py-1 text-xs font-semibold ${disputeStatusStyles[issue.status]}`}
            >
              {issue.disputedField}: {issueStatusLabels[issue.status]}
            </span>
          ))}
        </div>
      )}

      {editableInlineFields.length > 0 ? (
        <form onSubmit={saveInlineUpdate} className="mt-4 grid gap-3 lg:grid-cols-[1.25fr_1fr_1fr_1.5fr_auto]">
          {inlineUpdateFields.map((field) => (
            <InlineEditableField
              key={field.key}
              field={field}
              value={draft[field.key]}
              canEdit={canEditField(userRole, field.key)}
              onChange={(value) => setDraft((current) => ({ ...current, [field.key]: value }))}
            />
          ))}
          <div className="flex items-end gap-2">
            <button
              className="min-h-10 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white disabled:bg-slate-400"
              disabled={isSaving}
            >
              {isSaving ? 'Saving' : 'Save'}
            </button>
            {message && <span className="pb-2 text-xs font-semibold text-slate-500">{message}</span>}
          </div>
        </form>
      ) : (
        <div className="mt-4 rounded-md bg-slate-50 p-3 text-sm text-slate-600">
          {vehicle.currentStatus || vehicle.notes || 'Open full details to review this vehicle.'}
        </div>
      )}
    </div>
  );
}

function InlineEditableField({
  field,
  value,
  canEdit,
  onChange,
}: {
  field: (typeof inlineUpdateFields)[number];
  value: string;
  canEdit: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-xs font-semibold uppercase text-slate-500" title={getFieldHelp(field.key)}>
      {field.label}
      {field.kind === 'status' ? (
        <select
          className={fieldInputClass(canEdit)}
          disabled={!canEdit}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          {statusOrder.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      ) : (
        <input
          className={fieldInputClass(canEdit)}
          disabled={!canEdit}
          type={field.kind === 'date' ? 'date' : 'text'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </label>
  );
}

function WorkflowBoardVehicleCard({
  vehicle,
  onOpen,
}: {
  vehicle: ProductionVehicle;
  onOpen: (vehicle: ProductionVehicle) => void;
}) {
  const progress = getVehicleProgress(vehicle);
  const delay = getDelaySummary(vehicle);

  return (
    <button
      className="w-full rounded-md border border-slate-200 bg-white p-2 text-left text-xs hover:border-slate-400"
      onClick={() => onOpen(vehicle)}
      type="button"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-semibold text-slate-950">{cleanDisplay(vehicle.vehicleNumber)}</span>
        <span className={`rounded-full border px-2 py-0.5 ${riskStyles[getVehicleHealth(vehicle)]}`}>
          {getVehicleHealth(vehicle)}
        </span>
      </div>
      <div className="mt-1 text-slate-600">{getBuildDesignLabel(vehicle)}</div>
      <div className="mt-2 text-slate-500">
        Stage {progress.currentStageNumber}/{progress.totalStages}
      </div>
      <div className="mt-1 text-slate-600">Planned {formatDate(vehicle.expectedCompletionDate)}</div>
      <div className="text-slate-600">Actual / forecast {formatDate(getActualOrForecastFinish(vehicle))}</div>
      {delay.isDelayed && (
        <div className="mt-2 rounded border border-red-200 bg-red-50 px-2 py-1 font-semibold text-red-700">
          {delay.text}
        </div>
      )}
    </button>
  );
}

function DisputeCenter({
  disputes,
  vehicles,
  onSelectVehicle,
}: {
  disputes: VehicleDispute[];
  vehicles: ProductionVehicle[];
  onSelectVehicle: (vehicle: ProductionVehicle) => void;
}) {
  if (disputes.length === 0) {
    return null;
  }

  return (
    <div className="border-b border-slate-200 p-4">
      <h2 className="text-base font-semibold text-slate-950">Open Issues</h2>
      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        {disputes.slice(0, 6).map((dispute) => {
          const vehicle = vehicles.find((item) => item.id === dispute.vehicleId);
          return (
            <button
              key={dispute.id}
              className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-left hover:border-slate-400"
              onClick={() => vehicle && onSelectVehicle(vehicle)}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-slate-950">{dispute.vehicleNumber}</div>
                  <div className="text-xs text-slate-500">{dispute.disputedField}</div>
                </div>
                <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${disputeStatusStyles[dispute.status]}`}>
                  {issueStatusLabels[dispute.status]}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-slate-600">{dispute.alpineClaim}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function VehicleCardGrid({
  vehicles,
  disputes,
  onSelectVehicle,
}: {
  vehicles: ProductionVehicle[];
  disputes: VehicleDispute[];
  onSelectVehicle: (vehicle: ProductionVehicle) => void;
}) {
  if (vehicles.length === 0) {
    return (
      <div className="p-4">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
          No vehicles match the current filters.
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {vehicles.map((vehicle) => {
        const vehicleDisputes = disputes.filter(
          (dispute) => dispute.vehicleId === vehicle.id && dispute.status !== 'Resolved',
        );

        return (
          <article key={vehicle.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <VehicleImage vehicle={vehicle} />
            <div className="space-y-4 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-950">{vehicle.vehicleNumber}</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    {getBuildDesignLabel(vehicle)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {[
                      vehicle.modelYear,
                      vehicle.armoringLevel ? `Armouring Level ${cleanDisplay(vehicle.armoringLevel)}` : undefined,
                    ]
                      .filter(Boolean)
                      .join(' / ') || 'No build details'}
                  </p>
                </div>
                <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${riskStyles[vehicle.risk]}`}>
                  {vehicle.risk}
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                <VehicleProgressChip vehicle={vehicle} />
                {vehicleDisputes.length > 0 && (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
                    {vehicleDisputes.length} issue{vehicleDisputes.length === 1 ? '' : 's'}
                  </span>
                )}
              </div>

              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs font-semibold uppercase text-slate-500">Location</dt>
                  <dd className="mt-1 font-medium text-slate-800">{vehicle.facility || '-'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-slate-500">Delay / Variance</dt>
                  <dd className="mt-1">
                    <Variance value={vehicle.scheduleVarianceDays} />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-slate-500">Planned</dt>
                  <dd className="mt-1 font-medium text-slate-800">{formatDate(vehicle.expectedCompletionDate)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-slate-500">Actual / Forecast</dt>
                  <dd className="mt-1 font-medium text-slate-800">
                    {formatDate(getActualOrForecastFinish(vehicle))}
                  </dd>
                </div>
              </dl>

              <VehicleDelayAlert vehicle={vehicle} />

              <div className="min-h-12 rounded-md bg-slate-50 p-3 text-sm text-slate-600">
                <p className="line-clamp-2">{vehicle.currentStatus || vehicle.notes || vehicle.mevaNotes || 'No note yet.'}</p>
              </div>

              <button
                className="min-h-10 w-full rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:border-slate-500"
                onClick={() => onSelectVehicle(vehicle)}
                type="button"
              >
                Open
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function VehicleImage({ vehicle }: { vehicle: ProductionVehicle }) {
  const [hasError, setHasError] = useState(false);
  const image = getVehicleImage(vehicle);
  const phase = getJourneyPhase(vehicle);
  const isScheduled = phase === 'Scheduled';
  const isTransit = phase === 'Transit to MEVA' || phase === 'Transit to Alpine';

  if (isScheduled) {
    return (
      <div className="relative flex aspect-[16/9] items-center justify-center bg-slate-100">
        <div className="absolute left-3 top-3">
          <VehicleImagePhaseBadge vehicle={vehicle} />
        </div>
        <div className="px-4 text-center">
          <div className="text-sm font-semibold uppercase tracking-wide text-slate-500">Image available at MEVA</div>
          <div className="mt-1 text-xs text-slate-400">{phase}</div>
        </div>
      </div>
    );
  }

  if (!image || hasError) {
    return (
      <div className="relative flex aspect-[16/9] items-center justify-center bg-slate-100">
        <div className="absolute left-3 top-3">
          <VehicleImagePhaseBadge vehicle={vehicle} />
        </div>
        <div className="text-center">
          <div className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            {vehicle.designStyle || 'Vehicle'}
          </div>
          <div className="mt-1 text-xs text-slate-400">Image not added</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative aspect-[16/9] bg-slate-100">
      <div className="absolute left-3 top-3 z-10">
        <VehicleImagePhaseBadge vehicle={vehicle} />
      </div>
      <Image
        src={image.src}
        alt={`${image.label} showcase`}
        fill
        sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 25vw"
        className="object-contain p-4"
        quality={75}
        onError={() => setHasError(true)}
      />
      {isTransit && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/50 px-4 text-center">
          <div>
            <div className="text-base font-semibold text-slate-950">{phase}</div>
            <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
              {vehicle.productionStatus}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MasterTable({
  vehicles,
  onSelectVehicle,
}: {
  vehicles: ProductionVehicle[];
  onSelectVehicle: (vehicle: ProductionVehicle) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1800px] text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-3">Vehicle #</th>
            <th className="px-4 py-3">Build / Design</th>
            <th className="px-4 py-3">Facility</th>
            <th className="px-4 py-3">Phase</th>
            <th className="px-4 py-3">Stage</th>
            <th className="px-4 py-3">Health</th>
            <th className="px-4 py-3">Progress</th>
            <th className="px-4 py-3">Planned Finish</th>
            <th className="px-4 py-3">Actual / Forecast Finish</th>
            <th className="px-4 py-3">Days at MEVA</th>
            <th className="px-4 py-3">Delay / Variance</th>
            <th className="px-4 py-3">VIN</th>
            <th className="px-4 py-3">Latest Note</th>
            <th className="px-4 py-3">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {vehicles.map((vehicle) => {
            const progress = getVehicleProgress(vehicle);
            const delay = getDelaySummary(vehicle);
            const health = getVehicleHealth(vehicle);

            return (
              <tr key={vehicle.id} className="bg-white hover:bg-slate-50">
                <td className="px-4 py-3 font-semibold text-slate-950">{cleanDisplay(vehicle.vehicleNumber)}</td>
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-800">{getBuildDesignLabel(vehicle)}</div>
                  <div className="text-xs text-slate-500">
                    {[
                      vehicle.modelYear,
                      vehicle.armoringLevel ? `Armouring Level ${cleanDisplay(vehicle.armoringLevel)}` : undefined,
                    ]
                      .filter(Boolean)
                      .join(' / ') || 'No build details'}
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-700">{cleanDisplay(vehicle.facility) || 'Unassigned'}</td>
                <td className="px-4 py-3 text-slate-700">{getJourneyPhase(vehicle)}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusStyles[vehicle.productionStatus]}`}>
                    {vehicle.productionStatus}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${riskStyles[health]}`}>
                    {health}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {progress.currentStageNumber}/{progress.totalStages}
                </td>
                <td className="px-4 py-3 text-slate-700">{formatDate(vehicle.expectedCompletionDate)}</td>
                <td className="px-4 py-3 text-slate-700">
                  {formatDate(getActualOrForecastFinish(vehicle))}
                </td>
                <td className="px-4 py-3 text-slate-700">{formatNumber(getDaysAtMEVA(vehicle))}</td>
                <td className="px-4 py-3">
                  {delay.isDelayed ? (
                    <span className="font-semibold text-red-700">{delay.text}</span>
                  ) : (
                    <Variance value={vehicle.scheduleVarianceDays} />
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-600">{cleanDisplay(vehicle.vin) || '-'}</td>
                <td className="max-w-sm px-4 py-3 text-slate-700">
                  <div className="line-clamp-2">{getLatestNote(vehicle)}</div>
                </td>
                <td className="px-4 py-3">
                  <button
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-500"
                    onClick={() => onSelectVehicle(vehicle)}
                  >
                    Open
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function VehicleDetailPanel({
  vehicle,
  permissions,
  session,
  disputes,
  fieldObjections,
  onClose,
  onRefresh,
}: {
  vehicle: ProductionVehicle;
  permissions: RolePermissions;
  session: AppSession;
  disputes: VehicleDispute[];
  fieldObjections: FieldObjection[];
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [draft, setDraft] = useState<Record<DetailUpdateKey, string>>(() =>
    detailUpdateFields.reduce(
      (values, field) => ({
        ...values,
        [field.key]: getVehicleDraftValue(vehicle, field.key),
      }),
      {} as Record<DetailUpdateKey, string>,
    ),
  );
  const [disputedField, setDisputedField] = useState('Planned finish date');
  const [disputeType, setDisputeType] = useState('Late schedule');
  const [alpineClaim, setAlpineClaim] = useState('');
  const [mevaResponses, setMevaResponses] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [drawerMode, setDrawerMode] = useState<DetailDrawerMode>('status');
  const editableDetailFields = detailUpdateFields.filter((field) => canEditField(session.role, field.key));
  const activeFieldObjections = fieldObjections.filter(isActiveFieldObjection);

  async function updateVehicle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setMessage('');

    const response = await fetch(`/api/vehicles/${vehicle.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(editableDetailFields.map((field) => [field.key, draft[field.key]]))),
    });

    setIsSaving(false);

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setMessage(body?.error || 'Update failed');
      return;
    }

    setMessage('Vehicle updated.');
    onRefresh();
  }

  async function openDispute(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setMessage('');

    const response = await fetch('/api/disputes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vehicleId: vehicle.id,
        vehicleNumber: vehicle.vehicleNumber,
        disputeType,
        disputedField,
        alpineClaim,
      }),
    });

    setIsSaving(false);

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setMessage(body?.error || 'Could not raise issue');
      return;
    }

    setAlpineClaim('');
    setMessage('Issue sent to MEVA.');
    onRefresh();
  }

  async function updateDispute(dispute: VehicleDispute, status: VehicleDispute['status']) {
    setIsSaving(true);
    setMessage('');

    const response = await fetch(`/api/disputes/${dispute.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status,
        mevaResponse: permissions.canRespondToDisputes ? mevaResponses[dispute.id] : undefined,
      }),
    });

    setIsSaving(false);

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setMessage(body?.error || 'Could not update issue');
      return;
    }

    setMessage('Issue updated.');
    onRefresh();
  }

  async function createObjection(input: {
    fieldKey: FieldKey;
    currentValue: string;
    reason: string;
    suggestedValue: string;
    comment?: string;
  }) {
    setIsSaving(true);
    setMessage('');

    const response = await fetch('/api/field-objections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vehicleId: vehicle.id,
        fieldKey: input.fieldKey,
        currentValue: input.currentValue,
        reason: input.reason,
        suggestedValue: input.suggestedValue,
        comment: input.comment,
      }),
    });

    setIsSaving(false);

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setMessage(body?.error || 'Could not create field objection');
      return false;
    }

    setMessage('Field objection created and assigned to the responsible team.');
    onRefresh();
    return true;
  }

  async function updateFieldObjection(objection: FieldObjection, status: FieldObjectionStatus) {
    setIsSaving(true);
    setMessage('');

    const response = await fetch(`/api/field-objections/${objection.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });

    setIsSaving(false);

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setMessage(body?.error || 'Could not update field objection');
      return;
    }

    setMessage(`Field objection marked ${status}.`);
    onRefresh();
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/30 p-4">
      <div className="ml-auto min-h-full max-w-4xl rounded-lg bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white p-5">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Vehicle details</div>
            <h2 className="mt-1 text-2xl font-semibold text-slate-950">{cleanDisplay(vehicle.vehicleNumber)}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {[
                getBuildDesignLabel(vehicle),
                vehicle.modelYear,
                vehicle.armoringLevel ? `Armouring Level ${cleanDisplay(vehicle.armoringLevel)}` : undefined,
              ]
                .filter(Boolean)
                .join(' / ')}
            </p>
          </div>
          <button
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-slate-500 hover:bg-slate-50"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="space-y-5 p-5">
          <div className="inline-flex rounded-md border border-slate-300 bg-slate-50 p-1">
            <button
              className={`min-h-9 rounded px-4 text-sm font-semibold ${
                drawerMode === 'status' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
              onClick={() => setDrawerMode('status')}
              type="button"
            >
              Status
            </button>
            <button
              className={`min-h-9 rounded px-4 text-sm font-semibold ${
                drawerMode === 'edit' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
              onClick={() => setDrawerMode('edit')}
              type="button"
            >
              Edit
            </button>
          </div>

          {drawerMode === 'status' && (
            <>
              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="font-semibold text-slate-950">Vehicle summary</h3>
                <div className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
                  <Info label="Vehicle #" value={cleanDisplay(vehicle.vehicleNumber) || '-'} />
                  <Info label="Build / Design" value={getBuildDesignLabel(vehicle)} />
                  <Info label="VIN" value={cleanDisplay(vehicle.vin) || '-'} />
                  <Info label="Model Year" value={vehicle.modelYear ? String(vehicle.modelYear) : '-'} />
                  <Info label="Armouring Level" value={cleanDisplay(vehicle.armoringLevel) || '-'} />
                  <Info label="Facility / Plant" value={cleanDisplay(vehicle.facility) || '-'} />
                </div>
              </section>

              <VehicleTimeline vehicle={vehicle} />
            </>
          )}

          {message && (
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {message}
            </div>
          )}

          {drawerMode === 'edit' && (
            <form onSubmit={updateVehicle} className="rounded-lg border border-slate-200 p-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="font-semibold text-slate-950">Update vehicle</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {editableDetailFields.length > 0
                      ? `${session.organization} can edit ${editableDetailFields.length} managed field${editableDetailFields.length === 1 ? '' : 's'}.`
                      : 'View-only access for this vehicle.'}
                  </p>
                </div>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500">
                  Field ownership enforced
                </span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {detailUpdateFields.map((field) => (
                  <DetailEditableField
                    key={field.key}
                    field={field}
                    value={draft[field.key]}
                    canEdit={canEditField(session.role, field.key)}
                    canObject={canObjectToField(session.role, field.key)}
                    activeObjection={activeFieldObjections.find((objection) => objection.fieldKey === field.key)}
                    objections={fieldObjections.filter((objection) => objection.fieldKey === field.key)}
                    canManageObjection={activeFieldObjections.some(
                      (objection) => objection.fieldKey === field.key && objection.responsibleRole === session.role,
                    )}
                    onChange={(value) => setDraft((current) => ({ ...current, [field.key]: value }))}
                    onCreateObjection={(input) => createObjection({ fieldKey: field.key, ...input })}
                    onUpdateObjection={updateFieldObjection}
                  />
                ))}
              </div>
              <button
                className="mt-4 min-h-10 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white disabled:bg-slate-400"
                disabled={isSaving || editableDetailFields.length === 0}
              >
                {isSaving ? 'Saving update' : 'Save permitted fields'}
              </button>
            </form>
          )}

          {drawerMode === 'status' && permissions.canOpenDisputes && (
            <form onSubmit={openDispute} className="rounded-lg border border-red-200 bg-red-50 p-4">
              <h3 className="font-semibold text-slate-950">Raise an issue</h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-medium text-slate-700">
                  Type
                  <select
                    className="mt-1 min-h-10 w-full rounded-md border border-red-200 bg-white px-3 text-sm"
                    value={disputeType}
                    onChange={(event) => setDisputeType(event.target.value)}
                  >
                    <option>Late schedule</option>
                    <option>Finish date</option>
                    <option>Shipping date</option>
                    <option>Vehicle condition</option>
                    <option>Other</option>
                  </select>
                </label>
                <label className="text-sm font-medium text-slate-700">
                  What is wrong?
                  <select
                    className="mt-1 min-h-10 w-full rounded-md border border-red-200 bg-white px-3 text-sm"
                    value={disputedField}
                    onChange={(event) => setDisputedField(event.target.value)}
                  >
                    <option>Planned finish date</option>
                    <option>Actual finish date</option>
                    <option>Stage</option>
                    <option>Late days</option>
                    <option>Latest note</option>
                  </select>
                </label>
              </div>
              <label className="mt-3 block text-sm font-medium text-slate-700">
                Explain the issue
                <textarea
                  className="mt-1 min-h-28 w-full rounded-md border border-red-200 px-3 py-2 text-sm"
                  required
                  value={alpineClaim}
                  onChange={(event) => setAlpineClaim(event.target.value)}
                  placeholder="Tell MEVA what looks wrong and what correction or proof is needed."
                />
              </label>
              <button
                className="mt-4 min-h-10 rounded-md bg-red-700 px-4 text-sm font-semibold text-white disabled:bg-red-300"
                disabled={isSaving}
              >
                Raise issue
              </button>
            </form>
          )}

          {drawerMode === 'status' && permissions.canViewDisputes && (
            <section className="rounded-lg border border-slate-200 p-4">
              <h3 className="font-semibold text-slate-950">Issues</h3>
              <div className="mt-3 space-y-3">
                {disputes.length === 0 ? (
                  <p className="text-sm text-slate-500">No issues for this vehicle.</p>
                ) : (
                  disputes.map((dispute) => (
                    <div key={dispute.id} className="rounded-md border border-slate-200 p-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-slate-950">{dispute.disputeType}</div>
                          <div className="text-xs text-slate-500">{dispute.disputedField}</div>
                        </div>
                        <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${disputeStatusStyles[dispute.status]}`}>
                          {issueStatusLabels[dispute.status]}
                        </span>
                      </div>
                      <p className="mt-3 text-sm text-slate-700">{dispute.alpineClaim}</p>
                      {dispute.mevaResponse && (
                        <p className="mt-3 rounded-md bg-slate-50 p-3 text-sm text-slate-700">
                          <span className="font-semibold">MEVA answer:</span> {dispute.mevaResponse}
                        </p>
                      )}
                      {permissions.canRespondToDisputes && dispute.status !== 'Resolved' && (
                        <div className="mt-3 space-y-2">
                          <textarea
                            className="min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                            placeholder="MEVA answer, proof, or closing note"
                            value={mevaResponses[dispute.id] ?? dispute.mevaResponse ?? ''}
                            onChange={(event) =>
                              setMevaResponses((current) => ({
                                ...current,
                                [dispute.id]: event.target.value,
                              }))
                            }
                          />
                          <div className="flex flex-wrap gap-2">
                            <button
                              className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold"
                              type="button"
                              onClick={() => updateDispute(dispute, 'MEVA Reviewing')}
                            >
                              Reviewing
                            </button>
                            <button
                              className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold"
                              type="button"
                              onClick={() => updateDispute(dispute, 'MEVA Responded')}
                            >
                              Send answer
                            </button>
                            <button
                              className="rounded-md bg-slate-950 px-3 py-2 text-xs font-semibold text-white"
                              type="button"
                              onClick={() => updateDispute(dispute, 'Resolved')}
                            >
                              Resolve
                            </button>
                          </div>
                        </div>
                      )}
                      {session.role === 'ALPINE' && dispute.status === 'MEVA Responded' && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            className="rounded-md bg-emerald-700 px-3 py-2 text-xs font-semibold text-white"
                            type="button"
                            onClick={() => updateDispute(dispute, 'Alpine Accepted')}
                          >
                            Accept response
                          </button>
                          <button
                            className="rounded-md bg-violet-700 px-3 py-2 text-xs font-semibold text-white"
                            type="button"
                            onClick={() => updateDispute(dispute, 'Escalated')}
                          >
                            Escalate
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailEditableField({
  field,
  value,
  canEdit,
  canObject,
  activeObjection,
  objections,
  canManageObjection,
  onChange,
  onCreateObjection,
  onUpdateObjection,
}: {
  field: (typeof detailUpdateFields)[number];
  value: string;
  canEdit: boolean;
  canObject: boolean;
  activeObjection?: FieldObjection;
  objections: FieldObjection[];
  canManageObjection: boolean;
  onChange: (value: string) => void;
  onCreateObjection: (input: { currentValue: string; reason: string; suggestedValue: string; comment?: string }) => Promise<boolean>;
  onUpdateObjection: (objection: FieldObjection, status: FieldObjectionStatus) => void;
}) {
  const help = getFieldHelp(field.key);
  const [isObjecting, setIsObjecting] = useState(false);
  const [reason, setReason] = useState('');
  const [suggestedValue, setSuggestedValue] = useState('');
  const [comment, setComment] = useState('');

  async function submitObjection() {
    const created = await onCreateObjection({
      currentValue: value,
      reason,
      suggestedValue,
      comment,
    });

    if (created) {
      setIsObjecting(false);
      setReason('');
      setSuggestedValue('');
      setComment('');
    }
  }

  return (
    <div className="text-sm font-medium text-slate-700" title={help}>
      <span className="flex flex-wrap items-center gap-2">
        {field.label}
        <span
          className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
            canEdit ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-500'
          }`}
        >
          {getOwnerLabel(field.key)}
        </span>
        {activeObjection && (
          <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">
            Objected
          </span>
        )}
      </span>
      {field.kind === 'status' ? (
        <select
          className={fieldInputClass(canEdit, Boolean(activeObjection))}
          disabled={!canEdit}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          {statusOrder.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      ) : field.kind === 'textarea' ? (
        <textarea
          className={`${fieldInputClass(canEdit, Boolean(activeObjection))} min-h-24 py-2`}
          disabled={!canEdit}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          className={fieldInputClass(canEdit, Boolean(activeObjection))}
          disabled={!canEdit}
          type={field.kind === 'date' ? 'date' : 'text'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      <div className="mt-1 flex flex-wrap items-center gap-2">
        {!canEdit && <span className="text-xs font-normal text-slate-500">Read-only for your role</span>}
        {canObject && !activeObjection && (
          <button
            className="text-xs font-semibold text-red-700 underline-offset-4 hover:underline"
            onClick={() => setIsObjecting((current) => !current)}
            type="button"
          >
            {isObjecting ? 'Cancel objection' : 'Object to field'}
          </button>
        )}
      </div>
      {activeObjection && (
        <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          <div className="font-semibold">
            {activeObjection.status}: {activeObjection.reason}
          </div>
          <div className="mt-1">Suggested: {activeObjection.suggestedValue}</div>
          {canManageObjection && (
            <div className="mt-2 flex flex-wrap gap-2">
              {(['Reviewed', 'Accepted', 'Rejected', 'Resolved'] as FieldObjectionStatus[]).map((status) => (
                <button
                  key={status}
                  className="rounded-md border border-red-200 bg-white px-2 py-1 text-[11px] font-semibold text-red-700"
                  onClick={() => onUpdateObjection(activeObjection, status)}
                  type="button"
                >
                  {status}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {!activeObjection && objections.length > 0 && (
        <div className="mt-2 text-xs text-slate-500">
          {objections.length} prior objection{objections.length === 1 ? '' : 's'} recorded.
        </div>
      )}
      {isObjecting && (
        <div className="mt-2 rounded-md border border-red-200 bg-red-50 p-3">
          <div className="grid gap-2">
            <input
              className="min-h-9 rounded-md border border-red-200 bg-white px-3 text-xs font-normal"
              placeholder="Reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
            <input
              className="min-h-9 rounded-md border border-red-200 bg-white px-3 text-xs font-normal"
              placeholder="Suggested corrected value"
              value={suggestedValue}
              onChange={(event) => setSuggestedValue(event.target.value)}
            />
            <textarea
              className="min-h-16 rounded-md border border-red-200 bg-white px-3 py-2 text-xs font-normal"
              placeholder="Optional comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
            />
          </div>
          <button
            className="mt-2 min-h-9 rounded-md bg-red-700 px-3 text-xs font-semibold text-white disabled:bg-red-300"
            disabled={!reason.trim() || !suggestedValue.trim()}
            onClick={submitObjection}
            type="button"
          >
            Submit objection
          </button>
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border-t border-slate-100 pt-3 first:border-t-0 first:pt-0 sm:first:border-t sm:first:pt-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        <TooltipLabel label={label} />
      </div>
      <div className="mt-1 break-words text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function Variance({ value }: { value?: number }) {
  if (value === undefined) {
    return <span className="text-slate-400">-</span>;
  }

  if (value <= 0) {
    return <span className="font-semibold text-emerald-700">{Math.abs(value)}d ahead/on time</span>;
  }

  return <span className="font-semibold text-red-700">{value}d late</span>;
}

function cleanDisplay(value?: string | number) {
  if (value === undefined || value === null) {
    return '';
  }

  return String(value).replace(/\s+/g, ' ').trim();
}

function getBuildDesignLabel(vehicle: ProductionVehicle) {
  return cleanDisplay(vehicle.designStyle || vehicle.vehicle) || 'Build / Design not set';
}

function getActualOrForecastFinish(vehicle: ProductionVehicle) {
  return vehicle.actualProductionCompletionDate || vehicle.actualCompletionDate || vehicle.expectedCompletionDate;
}

function isActiveFieldObjection(objection: FieldObjection) {
  return objection.status === 'Open' || objection.status === 'Reviewed';
}

function getLatestNote(vehicle: ProductionVehicle) {
  return cleanDisplay(vehicle.currentStatus || vehicle.notes || vehicle.mevaNotes) || '-';
}

function formatDate(value?: string) {
  if (!value) {
    return '-';
  }

  return new Intl.DateTimeFormat('en', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatNumber(value?: number) {
  return typeof value === 'number' ? value.toLocaleString() : '-';
}
