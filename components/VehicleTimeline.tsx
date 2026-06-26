'use client';

import { useState } from 'react';
import type { ProductionStatus, ProductionVehicle } from '@/lib/types';
import {
  getDelaySummary,
  getFieldTooltip,
  getStageOwner,
  getStageState,
  getStageSupportingFields,
  getVehicleHealth,
  getVehiclePhase,
  getVehicleProgress,
  getWorkflowStatus,
  STAGE_ORDER,
  type StageSupportingField,
  type TimelineStageState,
} from '@/lib/vehicleTimeline';

type VisualStageState = TimelineStageState | 'delayed';

const nodeStyles: Record<VisualStageState, string> = {
  completed: 'border-emerald-500 bg-emerald-500 text-white',
  current: 'border-slate-950 bg-white text-slate-950 ring-4 ring-slate-100',
  pending: 'border-slate-300 bg-white text-slate-300',
  delayed: 'border-red-500 bg-white text-red-600 ring-4 ring-red-50',
};

const chipStyles: Record<VisualStageState, string> = {
  completed: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  current: 'border-slate-300 bg-slate-100 text-slate-800',
  pending: 'border-slate-200 bg-white text-slate-500',
  delayed: 'border-red-200 bg-red-50 text-red-700',
};

export function VehicleTimeline({ vehicle }: { vehicle: ProductionVehicle }) {
  const [expandedStages, setExpandedStages] = useState<Partial<Record<ProductionStatus, boolean>>>({});
  const currentStatus = getWorkflowStatus(vehicle);
  const progress = getVehicleProgress(vehicle);
  const delay = getDelaySummary(vehicle);

  return (
    <section className="rounded-lg border border-slate-200 bg-white px-4 py-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-semibold text-slate-950">Vehicle trajectory</h3>
          <p className="mt-1 text-sm text-slate-500">Journey from scheduled order to Alpine receipt.</p>
        </div>
        <VehicleProgressChip vehicle={vehicle} />
      </div>

      <ol className="relative mt-7 before:absolute before:bottom-4 before:left-[11px] before:top-3 before:w-px before:bg-slate-200">
        {STAGE_ORDER.map((stage, index) => {
          const state = getStageState(currentStatus, stage);
          const visualState: VisualStageState = delay.isDelayed && state === 'current' ? 'delayed' : state;
          const defaultFields = getStageSupportingFields(vehicle, stage, { defaultOnly: true }).slice(0, 3);
          const allFields = getStageSupportingFields(vehicle, stage);
          const extraFields = allFields.filter(
            (field) =>
              !defaultFields.some(
                (defaultField) => defaultField.key === field.key && defaultField.label === field.label,
              ),
          );
          const isExpanded = Boolean(expandedStages[stage]);
          const visibleFields = isExpanded ? [...defaultFields, ...extraFields] : defaultFields;

          return (
            <li key={stage} className="relative grid grid-cols-[1.5rem_1fr] gap-4 pb-9 last:pb-0">
              <div
                aria-label={`${stage}: ${visualState === 'delayed' ? 'Delayed' : stateLabel(state)}`}
                className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full border ${nodeStyles[visualState]}`}
                title={visualState === 'delayed' ? 'Delayed' : stateLabel(state)}
              >
                <TimelineNodeIcon state={visualState} />
              </div>

              <div className="min-w-0">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-semibold leading-6 text-slate-950">{stage}</h4>
                      {visualState !== 'completed' && (
                        <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${chipStyles[visualState]}`}>
                          {visualState === 'delayed' ? 'Delayed' : stateLabel(state)}
                        </span>
                      )}
                    </div>
                    <span className="mt-1.5 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                      {getStageOwner(stage)}
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-slate-500">
                    {index + 1}/{progress.totalStages}
                  </span>
                </div>

                {visualState === 'delayed' && <DelayAlert text={delay.text} className="mt-3" compact />}

                {visibleFields.length > 0 ? (
                  <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
                    {visibleFields.map((field) => (
                      <TimelineField key={`${stage}-${field.key}-${field.label}`} field={field} />
                    ))}
                  </dl>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">No supporting details recorded yet.</p>
                )}

                {extraFields.length > 0 && (
                  <button
                    className="mt-3 text-xs font-semibold text-slate-500 underline-offset-4 hover:text-slate-800 hover:underline"
                    onClick={() =>
                      setExpandedStages((current) => ({
                        ...current,
                        [stage]: !isExpanded,
                      }))
                    }
                    type="button"
                  >
                    {isExpanded ? 'Hide details' : `View more (${extraFields.length})`}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function VehicleProgressChip({ vehicle }: { vehicle: ProductionVehicle }) {
  const progress = getVehicleProgress(vehicle);
  const delay = getDelaySummary(vehicle);

  return (
    <span
      className={`inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${
        delay.isDelayed
          ? 'border-red-200 bg-red-50 text-red-700'
          : 'border-slate-300 bg-slate-50 text-slate-800'
      }`}
    >
      {progress.label}
    </span>
  );
}

export function VehicleProgressMini({ vehicle }: { vehicle: ProductionVehicle }) {
  const progress = getVehicleProgress(vehicle);
  const delay = getDelaySummary(vehicle);
  const health = getVehicleHealth(vehicle);

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase text-slate-500">Progress</span>
        <span className="text-xs font-semibold text-slate-800">
          {progress.currentStageNumber}/{progress.totalStages} {progress.stage}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
        <div
          className={`h-full rounded-full ${delay.isDelayed ? 'bg-red-500' : 'bg-slate-900'}`}
          style={{ width: `${progress.percentage}%` }}
        />
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
        <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-slate-700">{health}</span>
        {delay.isDelayed && <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-red-700">{delay.text}</span>}
      </div>
    </div>
  );
}

export function VehicleProgressBar({ vehicle }: { vehicle: ProductionVehicle }) {
  const progress = getVehicleProgress(vehicle);
  const delay = getDelaySummary(vehicle);

  return (
    <div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
        <div
          className={`h-full rounded-full ${delay.isDelayed ? 'bg-red-500' : 'bg-slate-900'}`}
          style={{ width: `${progress.percentage}%` }}
        />
      </div>
      <div className="mt-1 text-xs font-semibold text-slate-500">
        {progress.currentStageNumber}/{progress.totalStages} complete
      </div>
    </div>
  );
}

export function VehicleImagePhaseBadge({ vehicle }: { vehicle: ProductionVehicle }) {
  const phase = getVehiclePhase(vehicle);

  return (
    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold shadow-sm ${phase.className}`}>
      {phase.label}
    </span>
  );
}

export function VehicleDelayAlert({ vehicle, className = '' }: { vehicle: ProductionVehicle; className?: string }) {
  const delay = getDelaySummary(vehicle);

  if (!delay.isDelayed) {
    return null;
  }

  return <DelayAlert text={delay.text} className={className} />;
}

function TimelineNodeIcon({ state }: { state: VisualStageState }) {
  if (state === 'completed') {
    return (
      <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 16 16">
        <path
          d="M3.5 8.2 6.6 11 12.5 4.8"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
    );
  }

  if (state === 'current') {
    return <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-slate-950" />;
  }

  if (state === 'delayed') {
    return <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-red-500" />;
  }

  return <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full border border-slate-300 bg-white" />;
}

function TimelineField({ field }: { field: StageSupportingField }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase text-slate-500">
        <TooltipLabel label={field.label} />
      </dt>
      <dd className="mt-0.5 break-words text-sm font-medium text-slate-800">{field.value}</dd>
    </div>
  );
}

export function TooltipLabel({ label }: { label: string }) {
  const tooltip = getFieldTooltip(label);
  const showInfoIcon = Boolean(tooltip && shouldShowInfoIcon(label));

  return (
    <span className="inline-flex items-center gap-1" title={tooltip}>
      {label}
      {showInfoIcon && (
        <span
          aria-hidden="true"
          className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-slate-300 bg-white text-[9px] font-semibold normal-case text-slate-400"
        >
          i
        </span>
      )}
    </span>
  );
}

function shouldShowInfoIcon(label: string) {
  return [
    'Progress',
    'Health',
    'Planned Finish',
    'Actual / Forecast Finish',
    'Shipping Days Alpine to MEVA',
    'Design Change / Confirmation Time',
    'Actual Production Time',
    'Days at MEVA',
    'Production Completed Date',
    'Final Completion / Verification Date',
    'Schedule Variance',
    'Ready Since',
    'Shipping Days MEVA to Alpine',
  ].includes(label);
}

function DelayAlert({ text, className = '', compact = false }: { text: string; className?: string; compact?: boolean }) {
  return (
    <div
      className={`rounded-md border border-red-200 bg-red-50/80 text-red-700 ${
        compact ? 'px-2 py-1 text-xs font-semibold' : 'border-l-4 px-3 py-2 text-sm font-semibold'
      } ${className}`}
    >
      {text}
    </div>
  );
}

function stateLabel(state: TimelineStageState) {
  const labels: Record<TimelineStageState, string> = {
    completed: 'Completed',
    current: 'Current',
    pending: 'Pending',
  };

  return labels[state];
}
