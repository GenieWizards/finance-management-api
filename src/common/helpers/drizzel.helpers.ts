// This function helps to build update set in case of conflict.

import type { Column } from "drizzle-orm";
import { sql } from "drizzle-orm";
import type { PgTable, PgUpdateSetSource } from "drizzle-orm/pg-core";

export function conflictUpdateSet<TTable extends PgTable>(
  table: TTable,
  columns: (keyof TTable["_"]["columns"] & keyof TTable)[],
): PgUpdateSetSource<TTable> {
  return Object.assign(
    {},
    ...columns.map(k => ({ [k]: sql.raw(`excluded.${(table[k] as Column).name}`).mapWith(table[k] as Column) })),
  ) as PgUpdateSetSource<TTable>;
}
