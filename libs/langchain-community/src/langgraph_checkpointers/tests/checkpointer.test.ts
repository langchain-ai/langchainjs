/* eslint-disable no-process-env */

import { v6 } from "uuid";
import { describe, it, expect, jest } from "@jest/globals";
import { Checkpoint } from "@langchain/langgraph";
import { VercelKVSaver } from "../vercel_kv.js";

function uuid6(clockseq: number): string {
  return v6({ clockseq });
}

const checkpoint1: Checkpoint = {
  v: 1,
  id: uuid6(-1),
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
};

const checkpoint2: Checkpoint = {
  v: 1,
  id: uuid6(1),
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
};

if (!process.env.VERCEL_KV_API_URL || !process.env.VERCEL_KV_API_TOKEN) {
  throw new Error(
    "VERCEL_KV_API_URL and VERCEL_KV_API_TOKEN must be set in the environment"
  );
}

describe("VercelKVSaver", () => {
  it("should save and retrieve checkpoints correctly", async () => {
    
    const vercelSaver = new VercelKVSaver({
      url: process.env.VERCEL_KV_API_URL,
      token: !process.env.VERCEL_KV_API_TOKEN,
    });

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
    const checkpointTupleGenerator = await vercelSaver.list({
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
