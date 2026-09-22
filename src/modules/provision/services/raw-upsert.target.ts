import { DataSource } from 'typeorm';

// Postgres-only upsert adapter used by the provisioner against the rxsoft
// backend and emr databases. Tables are addressed by name (no entity classes
// needed) and upserted via INSERT ... ON CONFLICT (conflictKeys) DO UPDATE.
// Only columns that actually exist on the table are written, so caller-side
// convenience fields are safely dropped; org-scoped reads filter to one org.
export class RawUpsertTarget {
  private columns?: string[];

  constructor(
    private readonly dataSource: DataSource,
    private readonly tableName: string,
    private readonly conflictKeys: string[] = ['id'],
    private readonly organizationId?: string,
    private readonly softDeleteColumn = 'deleted_at',
  ) {}

  // Reads only live rows; org-scoped tables are filtered to this org. The
  // soft-delete filter is applied only when the table actually has that column.
  async findAll(): Promise<Record<string, any>[]> {
    const clauses: string[] = [];
    const params: any[] = [];
    if (this.organizationId) {
      params.push(this.organizationId);
      clauses.push(`organization_id = $${params.length}`);
    }
    if (await this.hasSoftDelete()) {
      clauses.push(`"${this.softDeleteColumn}" IS NULL`);
    }
    const where = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
    return this.dataSource.query(
      `SELECT * FROM "${this.tableName}"${where}`,
      params,
    );
  }

  // Upserts rows in batches; existing rows (by conflictKeys) are updated with
  // the new values, new rows are inserted. Rows sharing the same conflict-key
  // values are collapsed (last occurrence wins) so Postgres never sees the
  // same conflict target twice in one statement. Soft-deleted rows written
  // through here are revived (soft-delete column reset to the live value).
  async save(entities: Record<string, any>[]): Promise<void> {
    if (!entities.length) return;
    const tableCols = new Set(await this.getColumns());
    const softCol = this.softDeleteColumn;
    const conflictCols = this.conflictKeys
      .filter((c) => tableCols.has(c))
      .map((c) => `"${c}"`);
    if (!conflictCols.length) {
      throw new Error(
        `Table "${this.tableName}" has none of the conflict keys [${this.conflictKeys.join(', ')}]`,
      );
    }

    const deduped: Record<string, any>[] = [];
    const seen = new Map<string, number>();
    for (const entity of entities) {
      const key = this.conflictKeys
        .filter((c) => tableCols.has(c) && entity[c] !== undefined)
        .map((c) => String(entity[c] ?? ''))
        .join('\u0000');
      if (key && seen.has(key)) {
        deduped[seen.get(key)!] = entity;
        continue;
      }
      if (key) seen.set(key, deduped.length);
      deduped.push(entity);
    }

    // Normalize each entity to its effective (table-intersected) column list
    // and value array, then group by column signature so each batch uses one
    // combined VALUES clause.
    const bySig = new Map<string, { cols: string[]; values: any[][] }>();
    for (const entity of deduped) {
      let cols = Object.keys(entity).filter((c) => tableCols.has(c));
      if (!cols.length) continue;

      if (tableCols.has(softCol) && !cols.includes(softCol)) {
        cols = [...cols, softCol];
        entity[softCol] = null;
      }

      const values = cols.map((c) => (entity[c] === '' ? null : entity[c]));
      const sig = cols.join('|');
      if (!bySig.has(sig)) bySig.set(sig, { cols, values: [] });
      bySig.get(sig)!.values.push(values);
    }

    const BATCH = 500;
    for (const { cols, values } of bySig.values()) {
      const colList = cols.map((c) => `"${c}"`).join(', ');
      // Never rewrite the primary key or the conflict keys on conflict; update
      // only the remaining columns present in this batch's insert.
      const nonConflict = cols.filter(
        (c) => !this.conflictKeys.includes(c) && c !== 'id',
      );
      const updateSql =
        nonConflict.length > 0
          ? `DO UPDATE SET ${nonConflict
              .map((c) => `"${c}" = EXCLUDED."${c}"`)
              .join(', ')}`
          : 'DO NOTHING';
      for (let i = 0; i < values.length; i += BATCH) {
        const chunk = values.slice(i, i + BATCH);
        const placeholders = chunk
          .map(
            (_, r) =>
              `(${cols.map((_, c) => `$${r * cols.length + c + 1}`).join(', ')})`,
          )
          .join(', ');
        const sql = `INSERT INTO "${this.tableName}" (${colList})
          VALUES ${placeholders}
          ON CONFLICT (${conflictCols.join(', ')}) ${updateSql}`;
        await this.dataSource.query(sql, chunk.flat());
      }
    }
  }

  // Introspects the table's columns, cached per target instance.
  async getColumns(): Promise<string[]> {
    if (this.columns) return this.columns;
    try {
      const result = await this.dataSource.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name = $1 AND table_schema = current_schema()`,
        [this.tableName],
      );
      this.columns = result.map((r: any) => r.column_name);
    } catch {
      this.columns = [];
    }
    return this.columns ?? [];
  }

  async hasSoftDelete(): Promise<boolean> {
    const cols = await this.getColumns();
    return cols.includes(this.softDeleteColumn);
  }
}
