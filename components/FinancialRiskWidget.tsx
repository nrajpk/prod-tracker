'use client';

import type { ProductionVehicle } from '@/lib/types';

interface ScheduleRiskWidgetProps {
  vehicles: ProductionVehicle[];
}

export default function FinancialRiskWidget({ vehicles }: ScheduleRiskWidgetProps) {
  const delayedVehicles = vehicles
    .filter((vehicle) => vehicle.risk === 'Late' || vehicle.risk === 'Watch')
    .sort((a, b) => (b.scheduleVarianceDays || 0) - (a.scheduleVarianceDays || 0))
    .slice(0, 5);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <h3 className="text-base font-semibold text-slate-950">Schedule Check</h3>
      <div className="mt-4 space-y-3">
        {delayedVehicles.length === 0 ? (
          <p className="text-sm text-slate-500">No late or watch-list vehicles in this view.</p>
        ) : (
          delayedVehicles.map((vehicle) => (
            <div key={vehicle.id} className="rounded-md border border-slate-200 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-slate-950">{vehicle.vehicleNumber}</div>
                  <div className="text-sm text-slate-500">{vehicle.productionStatus}</div>
                </div>
                <div className="text-right text-sm font-semibold text-red-700">
                  {vehicle.scheduleVarianceDays && vehicle.scheduleVarianceDays > 0
                    ? `${vehicle.scheduleVarianceDays}d late`
                    : vehicle.risk}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
