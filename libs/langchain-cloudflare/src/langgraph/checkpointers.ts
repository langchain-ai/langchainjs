import { D1Database } from "@cloudflare/workers-types";

import { RunnableConfig } from "@langchain/core/runnables";
import {
  BaseCheckpointSaver,
  Checkpoint,
  CheckpointMetadata,
  CheckpointTuple,
  SerializerProtocol,
} from "@langchain/langgraph/web";

// snake_case is used to match Python implementation
interface Row {
  checkpoint: string;
  metadata: string;
  parent_id?: string;
  thread_id: string;
  checkpoint_id: string;
}

export type CloudflareD1SaverFields = {
  db: D1Database;
}

export class CloudflareD1Saver extends BaseCheckpointSaver {
  db: D1Database;

  protected isSetup: boolean;

  constructor(fields: CloudflareD1SaverFields, serde?: SerializerProtocol<Checkpoint>) {
    super(serde);
    this.db = fields.db;
    this.isSetup = false;
  }

  private async setup() {
    if (this.isSetup) {
      return;
    }

    try {
      await this.db.exec(`
CREATE TABLE IF NOT EXISTS checkpoints (thread_id TEXT NOT NULL, checkpoint_id TEXT NOT NULL, parent_id TEXT, checkpoint BLOB, metadata BLOB, PRIMARY KEY (thread_id, checkpoint_id));`);
    } catch (error) {
      console.log("Error creating checkpoints table", error);
      throw error;
    }

    this.isSetup = true;
  }

  async getTuple(config: RunnableConfig): Promise<CheckpointTuple | undefined> {
    await this.setup();
    const thread_id = config.configurable?.thread_id;
    const checkpoint_id = config.configurable?.checkpoint_id;

    if (checkpoint_id) {
      try {
        const row: Row | null = await this.db
          .prepare(
            `SELECT checkpoint, parent_id, metadata FROM checkpoints WHERE thread_id = ? AND checkpoint_id = ?`
          )
          .bind(thread_id, checkpoint_id)
          .first();

        if (row) {
          return {
            config,
            checkpoint: (await this.serde.parse(row.checkpoint)) as Checkpoint,
            metadata: (await this.serde.parse(
              row.metadata
            )) as CheckpointMetadata,
            parentConfig: row.parent_id
              ? {
                  configurable: {
                    thread_id,
                    checkpoint_id: row.parent_id,
                  },
                }
              : undefined,
          };
        }
      } catch (error) {
        console.log("Error retrieving checkpoint", error);
        throw error;
      }
    } else {
      const row: Row | null = await this.db
        .prepare(
          `SELECT thread_id, checkpoint_id, parent_id, checkpoint, metadata FROM checkpoints WHERE thread_id = ? ORDER BY checkpoint_id DESC LIMIT 1`
        )
        .bind(thread_id)
        .first();

      if (row) {
        return {
          config: {
            configurable: {
              thread_id: row.thread_id,
              checkpoint_id: row.checkpoint_id,
            },
          },
          checkpoint: (await this.serde.parse(row.checkpoint)) as Checkpoint,
          metadata: (await this.serde.parse(
            row.metadata
          )) as CheckpointMetadata,
          parentConfig: row.parent_id
            ? {
                configurable: {
                  thread_id: row.thread_id,
                  checkpoint_id: row.parent_id,
                },
              }
            : undefined,
        };
      }
    }

    return undefined;
  }

  async *list(
    config: RunnableConfig,
    limit?: number,
    before?: RunnableConfig
  ): AsyncGenerator<CheckpointTuple> {
    await this.setup();
    const thread_id = config.configurable?.thread_id;
    let sql = `SELECT thread_id, checkpoint_id, parent_id, checkpoint, metadata FROM checkpoints WHERE thread_id = ? ${
      before ? "AND checkpoint_id < ?" : ""
    } ORDER BY checkpoint_id DESC`;
    if (limit) {
      sql += ` LIMIT ${limit}`;
    }
    const args = [thread_id, before?.configurable?.checkpoint_id].filter(
      Boolean
    );

    try {
      const { results: rows }: { results: Row[] } = await this.db.prepare(sql).bind(...args).all();

      if (rows) {
        for (const row of rows) {
          yield {
            config: {
              configurable: {
                thread_id: row.thread_id,
                checkpoint_id: row.checkpoint_id,
              },
            },
            checkpoint: (await this.serde.parse(row.checkpoint)) as Checkpoint,
            metadata: (await this.serde.parse(
              row.metadata
            )) as CheckpointMetadata,
            parentConfig: row.parent_id
              ? {
                  configurable: {
                    thread_id: row.thread_id,
                    checkpoint_id: row.parent_id,
                  },
                }
              : undefined,
          };
        }
      }
    } catch (error) {
      console.log("Error listing checkpoints", error);
      throw error;
    }
  }

  async put(
    config: RunnableConfig,
    checkpoint: Checkpoint,
    metadata: CheckpointMetadata
  ): Promise<RunnableConfig> {
    await this.setup();

    try {
      const row = [
        config.configurable?.thread_id ?? null,
        checkpoint.id,
        config.configurable?.checkpoint_id ?? null,
        this.serde.stringify(checkpoint),
        this.serde.stringify(metadata),
      ];

      this.db
        .prepare(
          `INSERT OR REPLACE INTO checkpoints (thread_id, checkpoint_id, parent_id, checkpoint, metadata) VALUES (?, ?, ?, ?, ?)`
        )
        .bind(...row)
        .run();
    } catch (error) {
      console.log("Error saving checkpoint", error);
      throw error;
    }

    return {
      configurable: {
        thread_id: config.configurable?.thread_id,
        checkpoint_id: checkpoint.id,
      },
    };
  }
}
