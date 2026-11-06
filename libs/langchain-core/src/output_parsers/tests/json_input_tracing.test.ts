import { describe, expect, test } from "vitest";
import { JsonOutputParser } from "../json.js";
import { AIMessageChunk } from "../../messages/ai.js";

const FULL_JSON = '{"answer":"hello"}';

async function* chunks(): AsyncGenerator<string> {
  yield '{"answer":"';
  yield "hello";
  yield '"}';
}

async function* aiChunks(): AsyncGenerator<AIMessageChunk> {
  yield new AIMessageChunk('{"answer":"');
  yield new AIMessageChunk("hello");
  yield new AIMessageChunk('"}');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EndHandler = (...args: any[]) => void;

function transformWith(
  input: AsyncGenerator<unknown>,
  handler: { handleChainEnd?: EndHandler; handleChainError?: EndHandler }
) {
  return new JsonOutputParser().transform(
    input as never,
    {
      callbacks: [handler],
    } as never
  );
}

describe("JsonOutputParser streaming input tracing (issue #12024)", () => {
  test("string stream: handleChainEnd receives the fully concatenated tracedInput", async () => {
    let tracedInput: unknown;
    const stream = transformWith(chunks(), {
      handleChainEnd(_output, _runId, _parentRunId, _tags, kwargs) {
        tracedInput = kwargs?.inputs;
      },
    });
    for await (const _ of stream) {
      // drain
    }
    expect(tracedInput).toEqual({ input: FULL_JSON });
  });

  test("AIMessageChunk stream: handleChainEnd receives the fully concatenated tracedInput", async () => {
    let tracedInput: { text?: string } | undefined;
    const stream = transformWith(aiChunks(), {
      handleChainEnd(_output, _runId, _parentRunId, _tags, kwargs) {
        tracedInput = kwargs?.inputs;
      },
    });
    for await (const _ of stream) {
      // drain
    }
    expect(tracedInput?.text).toBe(FULL_JSON);
  });

  test("failing input stream: handleChainError receives the fully concatenated tracedInput", async () => {
    let tracedInput: unknown;

    async function* failing(): AsyncGenerator<string> {
      yield '{"answer":"';
      yield "hello";
      throw new Error("stream boom");
    }

    const stream = transformWith(failing(), {
      handleChainError(_error, _runId, _parentRunId, _tags, kwargs) {
        tracedInput = kwargs?.inputs;
      },
    });
    await expect(async () => {
      for await (const _ of stream) {
        // drain
      }
    }).rejects.toThrow("stream boom");
    expect(tracedInput).toEqual({ input: '{"answer":"hello' });
  });

  test("output aggregation still yields the final parsed object (#8711 no regression)", async () => {
    let endOutput: unknown;
    const parsed: unknown[] = [];
    const stream = transformWith(chunks(), {
      handleChainEnd(output) {
        endOutput = output;
      },
    });
    for await (const chunk of stream) {
      parsed.push(chunk);
    }
    expect(parsed.at(-1)).toEqual({ answer: "hello" });
    expect(endOutput).toEqual({ answer: "hello" });
  });
});
