/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { describe, test, expect } from "@jest/globals";
import { Checkpoint, CheckpointTuple } from "@langchain/langgraph";
import { VercelKVSaver } from "../vercel_kv.js";

const checkpoint1: Checkpoint = {
  v: 1,
  id: "1ef390c8-3ed9-6132-ffff-12d236274621",
  ts: "2024-04-19T17:19:07.952Z",
  channel_values: {
    someKey1: "someValue1",
  },
  channel_versions: {
    someKey2: 1,
  },
  versions_seen: {
    someKey3: {
      someKey4: 1,
    },
  },
  pending_sends: [],
};

const checkpoint2: Checkpoint = {
  v: 1,
  id: "1ef390c8-3ed9-6133-8001-419c612dad04",
  ts: "2024-04-20T17:19:07.952Z",
  channel_values: {
    someKey1: "someValue2",
  },
  channel_versions: {
    someKey2: 2,
  },
  versions_seen: {
    someKey3: {
      someKey4: 2,
    },
  },
  pending_sends: [],
};

describe("VercelKVSaver", () => {
  const vercelSaver = new VercelKVSaver({
    url: process.env.VERCEL_KV_API_URL!,
    token: process.env.VERCEL_KV_API_TOKEN!,
  });

  test("should save and retrieve checkpoints correctly", async () => {
    // save checkpoint
    const runnableConfig = await vercelSaver.put(
      { configurable: { thread_id: "1" } },
      checkpoint1,
      { source: "update", step: -1, writes: null }
    );
    expect(runnableConfig).toEqual({
      configurable: {
        thread_id: "1",
        checkpoint_id: checkpoint1.id,
      },
    });

    // get checkpoint tuple
    const checkpointTuple = await vercelSaver.getTuple({
      configurable: { thread_id: "1" },
    });
    expect(checkpointTuple?.config).toEqual({
      configurable: {
        thread_id: "1",
        checkpoint_id: checkpoint1.id,
      },
    });
    expect(checkpointTuple?.checkpoint).toEqual(checkpoint1);

    // save another checkpoint
    await vercelSaver.put(
      {
        configurable: {
          thread_id: "1",
        },
      },
      checkpoint2,
      { source: "update", step: -1, writes: null }
    );
    // list checkpoints
    const checkpointTupleGenerator = vercelSaver.list({
      configurable: { thread_id: "1" },
    });

    const checkpointTuples: CheckpointTuple[] = [];

    for await (const checkpoint of checkpointTupleGenerator) {
      checkpointTuples.push(checkpoint);
    }
    expect(checkpointTuples.length).toBe(2);

    const checkpointTuple1 = checkpointTuples[0];
    const checkpointTuple2 = checkpointTuples[1];

    expect(checkpointTuple1.checkpoint.ts).toBe("2024-04-20T17:19:07.952Z");
    expect(checkpointTuple2.checkpoint.ts).toBe("2024-04-19T17:19:07.952Z");
  });
});
