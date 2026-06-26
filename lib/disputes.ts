import 'server-only';

import { randomUUID } from 'crypto';
import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import type { DisputeStatus, VehicleDispute } from '@/lib/types';

const storePath = path.join(process.cwd(), '.data', 'disputes.json');

export async function listDisputes() {
  return readDisputes();
}

export async function createDispute(input: {
  vehicleId: string;
  vehicleNumber: string;
  disputeType: string;
  disputedField: string;
  alpineClaim: string;
  openedBy: string;
  openedByRole: VehicleDispute['openedByRole'];
  openedByOrg: string;
}) {
  const disputes = await readDisputes();
  const now = new Date().toISOString();
  const dispute: VehicleDispute = {
    id: randomUUID(),
    vehicleId: input.vehicleId,
    vehicleNumber: input.vehicleNumber,
    disputeType: input.disputeType,
    disputedField: input.disputedField,
    alpineClaim: input.alpineClaim,
    status: 'Opened by Alpine',
    openedBy: input.openedBy,
    openedByRole: input.openedByRole,
    openedByOrg: input.openedByOrg,
    createdAt: now,
    updatedAt: now,
  };

  disputes.unshift(dispute);
  await writeDisputes(disputes);
  return dispute;
}

export async function updateDispute(
  id: string,
  input: {
    status?: DisputeStatus;
    mevaResponse?: string;
  },
) {
  const disputes = await readDisputes();
  const index = disputes.findIndex((dispute) => dispute.id === id);

  if (index === -1) {
    return null;
  }

  const now = new Date().toISOString();
  const nextStatus = input.status || disputes[index].status;

  disputes[index] = {
    ...disputes[index],
    status: nextStatus,
    mevaResponse: input.mevaResponse ?? disputes[index].mevaResponse,
    updatedAt: now,
    resolvedAt: nextStatus === 'Resolved' ? now : disputes[index].resolvedAt,
  };

  await writeDisputes(disputes);
  return disputes[index];
}

async function readDisputes() {
  try {
    const content = await readFile(storePath, 'utf8');
    return JSON.parse(content) as VehicleDispute[];
  } catch {
    return [];
  }
}

async function writeDisputes(disputes: VehicleDispute[]) {
  await mkdir(path.dirname(storePath), { recursive: true });
  await writeFile(storePath, `${JSON.stringify(disputes, null, 2)}\n`, 'utf8');
}
