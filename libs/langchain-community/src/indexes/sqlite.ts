// eslint-disable-next-line import/no-extraneous-dependencies
import Database, { Database as DatabaseType, Statement } from "better-sqlite3";
import { ListKeyOptions, RecordManagerInterface, UpdateOptions } from "./base.js";

interface TimeRow {
  epoch: number;
}

interface Record {
  k: string;
  ex: boolean;
}


/**
 * Options for configuring the SQLiteRecordManager class.
 */
export type SQLiteRecordManagerOptions = {
  /**
   * The file path or connection string of the SQLite database.
   */
  filepathOrConnectionString: string;
  
  /**
   * The name of the table in the SQLite database.
   */
  tableName: string;
};

export class SQLiteRecordManager implements RecordManagerInterface {
  lc_namespace = ["langchain", "recordmanagers", "sqlite"];

  tableName: string

  db: DatabaseType;

  namespace: string

  constructor(namespace: string, config: SQLiteRecordManagerOptions) {
    const { filepathOrConnectionString, tableName } = config;
    this.namespace = namespace;   
    this.tableName = tableName;
    this.db = new Database(filepathOrConnectionString);
  }

  async createSchema(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      try {
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS "${this.tableName}" (
            uuid TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
            key TEXT NOT NULL,
            namespace TEXT NOT NULL,
            updated_at REAL NOT NULL,
            group_id TEXT,
            UNIQUE (key, namespace)
          );
          CREATE INDEX IF NOT EXISTS updated_at_index ON "${this.tableName}" (updated_at);
          CREATE INDEX IF NOT EXISTS key_index ON "${this.tableName}" (key);
          CREATE INDEX IF NOT EXISTS namespace_index ON "${this.tableName}" (namespace);
          CREATE INDEX IF NOT EXISTS group_id_index ON "${this.tableName}" (group_id);
        `);
        resolve();
      } catch (error: unknown) {
        // Handle errors specific to SQLite
        console.error('Error creating schema:', error);
        reject(error);
      }
    });
  }

  async getTime(): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      try {
        const statement: Statement<[]> = this.db.prepare("SELECT strftime('%s', 'now') AS epoch");
        const {epoch} = statement.get() as TimeRow;
        resolve(epoch);
      } catch (error) {
        reject(error);
      }
    });
  }


  async update(keys: string[], updateOptions?: UpdateOptions): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        if (keys.length === 0) {
            resolve();
            return;
        }

        this.getTime()
            .then(async updatedAt => {
                const { timeAtLeast, groupIds: _groupIds } = updateOptions ?? {};

                if (timeAtLeast && updatedAt < timeAtLeast) {
                    throw new Error(`Time sync issue with database ${updatedAt} < ${timeAtLeast}`);
                }

                const groupIds = _groupIds ?? keys.map(() => null);

                if (groupIds.length !== keys.length) {
                    throw new Error(`Number of keys (${keys.length}) does not match number of group_ids ${groupIds.length})`);
                }

                const recordsToUpsert = keys.map((key, i) => [
                    key,
                    this.namespace,
                    updatedAt,
                    groupIds[i],
                ]);

                for (const row of recordsToUpsert) {
                  // Prepare the statement for each row with a fixed number of anonymous placeholders
                  const individualStatement = this.db.prepare(`
                      INSERT INTO "${this.tableName}" (key, namespace, updated_at, group_id)
                      VALUES (?, ?, ?, ?)
                      ON CONFLICT (key, namespace) DO UPDATE SET updated_at = excluded.updated_at;
                  `);
                  // Execute the prepared statement for the current row
                  individualStatement.run(...row);
              }

                resolve();
            })
            .catch(error => reject(error));
      });
  }

  async exists(keys: string[]): Promise<boolean[]> {
    return new Promise<boolean[]>((resolve, reject) => {
      if (keys.length === 0) {
        resolve([]);
        return;
      }

      const arrayPlaceholders = keys.map((_, i) => `$${i + 2}`).join(", ");

      const statement: Statement<[string, ...string[]]> = this.db.prepare(`
        SELECT k, (key is not null) ex
        FROM unnest(ARRAY[${arrayPlaceholders}]) k
        LEFT JOIN "${this.tableName}" ON k=key AND namespace = ?
      `);

      try {
        const result = statement.all(this.namespace, ...keys) as Record[];

        resolve(result.map(row => row.ex));
      } catch (error) {
        reject(error);
      }
    });
  }

  async listKeys(options?: ListKeyOptions): Promise<string[]> {
    return new Promise<string[]>((resolve, reject) => {
      const { before, after, limit, groupIds } = options ?? {};
      let query = `SELECT key FROM "${this.tableName}" WHERE namespace = ?`;
      const values: (string | number | (string | null)[])[] = [this.namespace];

      if (before) {
        query += ` AND updated_at < ?`;
        values.push(before);
      }

      if (after) {
        query += ` AND updated_at > ?`;
        values.push(after);
      }

      if (limit) {
        query += ` LIMIT ?`;
        values.push(limit);
      }

      if (groupIds && Array.isArray(groupIds)) {
        query += ` AND group_id IN (${groupIds.map(() => '?').join(', ')})`;
        values.push(...(groupIds as (string | number | (string | null)[])[]));
      }

      query += ";";

      try {
        const result = this.db.prepare(query).all(...values) as { key: string }[];
        resolve(result.map(row => row.key));
      } catch (error) {
        reject(error);
      }
    });
  }

  async deleteKeys(keys: string[]): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (keys.length === 0) {
        resolve();
        return;
      }

      const query = `DELETE FROM "${this.tableName}" WHERE namespace = ? AND key IN (${keys.map(() => '?').join(', ')});`;
      const values: (string | number)[] = [this.namespace, ...keys];

      try {
        this.db.prepare(query).run(...values);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

}