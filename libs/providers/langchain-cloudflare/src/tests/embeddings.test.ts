import type { Ai } from "@cloudflare/workers-types";
import { describe, expect, test, vi } from "vitest";
import { CloudflareWorkersAIEmbeddings } from "../embeddings.js";

const gemmaModel = "@cf/google/embeddinggemma-2";

function binding(run: ReturnType<typeof vi.fn>): Ai {
  return { run } as unknown as Ai;
}

describe("CloudflareWorkersAIEmbeddings", () => {
  test("retains the legacy request and response format", async () => {
    const run = vi.fn().mockResolvedValue({
      shape: [2, 2],
      data: [
        [1, 2],
        [3, 4],
      ],
    });
    const embeddings = new CloudflareWorkersAIEmbeddings({
      binding: binding(run),
    });
    expect(await embeddings.embedDocuments(["one\nline", "two"])).toEqual([
      [1, 2],
      [3, 4],
    ]);
    expect(run).toHaveBeenCalledWith("@cf/baai/bge-base-en-v1.5", {
      text: ["one line", "two"],
    });
  });

  test("does not send dimensions to legacy models", async () => {
    const run = vi.fn().mockResolvedValue({ data: [[1, 2]] });
    const embeddings = new CloudflareWorkersAIEmbeddings({
      binding: binding(run),
      dimensions: 128,
    });
    expect(await embeddings.embedQuery("query")).toEqual([1, 2]);
    expect(run).toHaveBeenCalledWith("@cf/baai/bge-base-en-v1.5", {
      text: ["query"],
    });
  });

  test("embeds an EmbeddingGemma 2 query without adding a task prefix", async () => {
    const run = vi
      .fn()
      .mockResolvedValue({ data: [{ index: 0, embedding: [1, 2] }] });
    const embeddings = new CloudflareWorkersAIEmbeddings({
      binding: binding(run),
      model: gemmaModel,
    });
    expect(
      await embeddings.embedQuery("task: search result | query: first\nsecond")
    ).toEqual([1, 2]);
    expect(run).toHaveBeenCalledWith(gemmaModel, {
      input: ["task: search result | query: first second"],
      encoding_format: "float",
    });
  });

  test("supports modelName and dimensions for EmbeddingGemma 2", async () => {
    const run = vi.fn().mockResolvedValue({ data: [{ embedding: [1, 2] }] });
    const embeddings = new CloudflareWorkersAIEmbeddings({
      binding: binding(run),
      modelName: gemmaModel,
      dimensions: 128,
      stripNewLines: false,
    });
    expect(
      await embeddings.embedDocuments(["title: none | text: first\nsecond"])
    ).toEqual([[1, 2]]);
    expect(run).toHaveBeenCalledWith(gemmaModel, {
      input: ["title: none | text: first\nsecond"],
      dimensions: 128,
      encoding_format: "float",
    });
  });

  test("preserves document and batch order even when batches finish out of order", async () => {
    let finishFirst: (() => void) | undefined;
    const firstFinished = new Promise<void>((resolve) => {
      finishFirst = resolve;
    });
    const run = vi
      .fn()
      .mockImplementation(async (_model: string, args: { input: string[] }) => {
        if (args.input[0] === "0") await firstFinished;
        else finishFirst?.();
        return {
          data: args.input.map((text, index) => ({
            index,
            embedding: [Number(text)],
          })),
        };
      });
    const embeddings = new CloudflareWorkersAIEmbeddings({
      binding: binding(run),
      model: gemmaModel,
    });
    const texts = Array.from({ length: 51 }, (_, i) => String(i));
    expect(await embeddings.embedDocuments(texts)).toEqual(
      texts.map((text) => [Number(text)])
    );
    expect(run).toHaveBeenCalledTimes(2);
    expect(run.mock.calls[0][1].input).toHaveLength(50);
    expect(run.mock.calls[1][1].input).toEqual(["50"]);
  });

  test("does not call the provider for empty documents", async () => {
    const run = vi.fn();
    const embeddings = new CloudflareWorkersAIEmbeddings({
      binding: binding(run),
      model: gemmaModel,
    });
    expect(await embeddings.embedDocuments([])).toEqual([]);
    expect(run).not.toHaveBeenCalled();
  });

  test("uses the existing caller for retries", async () => {
    const run = vi
      .fn()
      .mockRejectedValueOnce(new Error("Temporary error"))
      .mockResolvedValue({ data: [{ embedding: [1, 2] }] });
    const embeddings = new CloudflareWorkersAIEmbeddings({
      binding: binding(run),
      model: gemmaModel,
      maxRetries: 1,
    });
    expect(await embeddings.embedQuery("query")).toEqual([1, 2]);
    expect(run).toHaveBeenCalledTimes(2);
  });
});
