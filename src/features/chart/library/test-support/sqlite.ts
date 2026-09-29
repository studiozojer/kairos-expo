import { createRequire } from 'node:module';
import type { LibraryDatabase } from '../store';
// Bypass Jest's module loader for Node's native SQLite module (Node 22.13+).
const { DatabaseSync } = createRequire(__filename)('node:sqlite') as { DatabaseSync: new (path: string) => { exec(sql: string): void; prepare(sql: string): { run(...params: unknown[]): unknown; all(...params: unknown[]): unknown[]; get(...params: unknown[]): unknown }; close(): void } };
export function testDatabase() {
  const sqlite = new DatabaseSync(':memory:');
  const db: LibraryDatabase = {
    execAsync: async sql => { sqlite.exec(sql); },
    runAsync: async (sql, ...params) => sqlite.prepare(sql).run(...params),
    getAllAsync: async <T>(sql: string, ...params: (string | number | null)[]) => sqlite.prepare(sql).all(...params) as T[],
    getFirstAsync: async <T>(sql: string, ...params: (string | number | null)[]) => (sqlite.prepare(sql).get(...params) ?? null) as T | null,
  };
  return { db, close: () => sqlite.close() };
}
