import type { ChartDraft } from '../active/model';

export type ChartContent = ChartDraft;
export interface SyncRecord { id: string; revision: number; chart: ChartContent | null; updatedAt: string }
export interface SyncOperation { operationId: string; chartId: string; baseRevision: number; chart: ChartContent | null }
export interface SyncResult { operationId: string; outcome: 'applied' | 'replayed' | 'conflict'; record: SyncRecord | null }
export interface LibrarySyncState { enabled: boolean; cursor: number; lastSyncedAt: string | null; pending: number; conflicts: number }
