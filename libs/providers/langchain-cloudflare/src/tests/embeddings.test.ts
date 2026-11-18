import { describe, expect, test } from "vitest";
import type { Ai } from "@cloudflare/workers-types";

import { CloudflareWorkersAIEmbeddings } from "../embeddings.js";

/** A Workers AI binding that records each request's batch size. */
function recordingBinding() {
  const batchSizes: number[] = [];
  const binding = {
    async run(_model: string, input: { text: string[] }) {
      batchSizes.push(input.text.length);
      return { shape: [input.text.length, 1], data: input.text.map(() => [0]) };
    },
  } as unknown as Ai;
  return { binding, batchSizes };
}

const texts = (n: number) => Array.from({ length: n }, (_, i) => `text ${i}`);

describe("CloudflareWorkersAIEmbeddings batchSize", () => {
  test("uses the batchSize passed to the constructor", async () => {
    const { binding, batchSizes } = recordingBinding();
    const embeddings = new CloudflareWorkersAIEmbeddings({
      binding,
      batchSize: 10,
    });

    const vectors = await embeddings.embedDocuments(texts(25));

    expect(embeddings.batchSize).toBe(10);
    expect(batchSizes).toEqual([10, 10, 5]);
    expect(vectors).toHaveLength(25);
  });

  test("defaults to 50", async () => {
    const { binding, batchSizes } = recordingBinding();
    const embeddings = new CloudflareWorkersAIEmbeddings({ binding });

    await embeddings.embedDocuments(texts(60));

    expect(batchSizes).toEqual([50, 10]);
  });
});
