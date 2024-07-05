import { VercelKV, createClient } from "@vercel/kv";

import { RunnableConfig } from "@langchain/core/runnables";
import {
  BaseCheckpointSaver,
  Checkpoint,
  CheckpointMetadata,
  CheckpointTuple,
  SerializerProtocol,
} from "@langchain/langgraph/web";

// snake_case is used to match Python implementation
interface KVRow {
  checkpoint: string;
  metadata: string;
}

interface KVConfig {
  url: string;
  token: string;
}

export class VercelKVSaver extends BaseCheckpointSaver {
  private kv: VercelKV;

  constructor(config: KVConfig, serde?: SerializerProtocol<unknown>) {
    super(serde);
    this.kv = createClient(config);
  }

  async getTuple(config: RunnableConfig): Promise<CheckpointTuple | undefined> {
    const thread_id = config.configurable?.thread_id;
    const checkpoint_id = config.configurable?.checkpoint_id;

    if (!thread_id) {
      return undefined;
    }

    const key = checkpoint_id
      ? `${thread_id}:${checkpoint_id}`
      : `${thread_id}:last`;

    const row: KVRow | null = await this.kv.get(key);

    if (!row) {
      return undefined;
    }

    const [checkpoint, metadata] = await Promise.all([
      this.serde.parse(row.checkpoint),
      this.serde.parse(row.metadata),
    ]);

    return {
      checkpoint: checkpoint as Checkpoint,
      metadata: metadata as CheckpointMetadata,
      config: checkpoint_id
        ? config
        : {
            configurable: {
              thread_id,
              checkpoint_id: (checkpoint as Checkpoint).id,
            },
          },
    };
  }

  async *list(
    config: RunnableConfig,
    limit?: number,
    before?: RunnableConfig
  ): AsyncGenerator<CheckpointTuple> {
    const thread_id = config.configurable?.thread_id;

    // LUA script to get keys excluding those starting with "last"
    const luaScript = `
      local prefix = ARGV[1] .. ':'
      local keys = redis.call('keys', prefix .. '*')
      local result = {}
      for _, key in ipairs(keys) do
        if string.sub(key, string.len(prefix) + 1, string.len(prefix) + 4) ~= 'last' then
          table.insert(result, key)
        end
      end
      return result
    `;

    // Execute the LUA script with the thread_id as an argument
    const keys: string[] = await this.kv.eval(luaScript, [], thread_id);

    const filteredKeys = keys.filter((key: string) => {
      const [, checkpoint_id] = key.split(":");

      return !before || checkpoint_id < before?.configurable?.checkpoint_id;
    });

    const sortedKeys = filteredKeys
      .sort((a: string, b: string) => b.localeCompare(a))
      .slice(0, limit);

    const rows: (KVRow | null)[] = await this.kv.mget(...sortedKeys);
    for (const row of rows) {
      if (row) {
        const [checkpoint, metadata] = await Promise.all([
          this.serde.parse(row.checkpoint),
          this.serde.parse(row.metadata),
        ]);

        yield {
          config: {
            configurable: {
              thread_id,
              checkpoint_id: (checkpoint as Checkpoint).id,
            },
          },
          checkpoint: checkpoint as Checkpoint,
          metadata: metadata as CheckpointMetadata,
        };
      }
    }
  }

  async put(
    config: RunnableConfig,
    checkpoint: Checkpoint,
    metadata: CheckpointMetadata
  ): Promise<RunnableConfig> {
    const thread_id = config.configurable?.thread_id;

    if (!thread_id || !checkpoint.id) {
      throw new Error("Thread ID and Checkpoint ID must be defined");
    }

    const row: KVRow = {
      checkpoint: this.serde.stringify(checkpoint),
      metadata: this.serde.stringify(metadata),
    };

    // LUA script to set checkpoint data atomically"
    const luaScript = `
      local thread_id = ARGV[1]
      local checkpoint_id = ARGV[2]
      local row = ARGV[3]

      redis.call('SET', thread_id .. ':' .. checkpoint_id, row)
      redis.call('SET', thread_id .. ':last', row)
    `;

    // Save the checkpoint and the last checkpoint
    await this.kv.eval(luaScript, [], [thread_id, checkpoint.id, row]);

    return {
      configurable: {
        thread_id,
        checkpoint_id: checkpoint.id,
      },
    };
  }
}
