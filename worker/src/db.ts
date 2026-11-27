export const now = (): number => Date.now();

export const newId = (): string => crypto.randomUUID();

type BindValue = string | number | null | ArrayBuffer | Uint8Array;

export async function dbFirst<T>(db: D1Database, sql: string, ...bind: BindValue[]): Promise<T | null> {
  const stmt = db.prepare(sql);
  const bound = bind.length ? stmt.bind(...bind) : stmt;
  return (await bound.first<T>()) ?? null;
}

export async function dbAll<T>(db: D1Database, sql: string, ...bind: BindValue[]): Promise<T[]> {
  const stmt = db.prepare(sql);
  const bound = bind.length ? stmt.bind(...bind) : stmt;
  const result = await bound.all<T>();
  return result.results ?? [];
}

export async function dbRun(db: D1Database, sql: string, ...bind: BindValue[]): Promise<D1Result> {
  const stmt = db.prepare(sql);
  const bound = bind.length ? stmt.bind(...bind) : stmt;
  return bound.run();
}
