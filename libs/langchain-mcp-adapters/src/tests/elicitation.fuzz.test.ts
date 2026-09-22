import {
  Annotation,
  Command,
  MemorySaver,
  START,
  END,
  StateGraph,
  type Interrupt,
} from "@langchain/langgraph";
import type {
  CallToolResult,
  InputRequest,
  InputRequiredResult,
} from "@modelcontextprotocol/client";
import { describe, expect, it } from "vitest";

import {
  callToolWithElicitation,
  createMCPElicitationResume,
  type ElicitationRoundParams,
} from "../elicitation.js";
import { isToolException } from "../utils/errors.js";

/**
 * Deterministic PRNG (mulberry32), so a failing case replays from its seed.
 *
 * Every property below prints the seed it ran with, and the seeds themselves
 * come from a fixed list rather than the clock: a red run here is always
 * reproducible.
 */
function rng(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEEDS = [1, 7, 42, 1337, 90210, 525600, 8675309];

/** One wire exchange, as `callToolWithElicitation` expects to issue it. */
type Round = (
  params: ElicitationRoundParams
) => Promise<CallToolResult | InputRequiredResult>;

const pick = <T>(random: () => number, values: readonly T[]): T =>
  values[Math.floor(random() * values.length)];

/**
 * One form question; `message` is what a human would be reading.
 *
 * `properties` is a JSON Schema record the adapter passes through verbatim —
 * zod rebuilds a ZodObject's keys in schema order, so a record is the only
 * place key order survives as far as the comparison.
 */
function question(message: string, swap = false): InputRequest {
  const confirm = { type: "boolean" } as const;
  const note = { type: "string" } as const;

  return {
    method: "elicitation/create" as const,
    params: {
      mode: "form" as const,
      message,
      requestedSchema: {
        type: "object" as const,
        properties: swap ? { note, confirm } : { confirm, note },
        required: ["confirm"],
      },
    },
  };
}

const accepted = { action: "accept" as const, content: { confirm: true } };

const completed: CallToolResult = {
  content: [{ type: "text", text: "done" }],
};

/** Drive one tool call inside a graph so `interrupt()` has somewhere to land. */
function graphFor(
  round: Parameters<typeof callToolWithElicitation>[0],
  args: Record<string, unknown> = { label: "operation" }
) {
  const State = Annotation.Root({ done: Annotation<boolean>() });

  return new StateGraph(State)
    .addNode("call", async () => {
      await callToolWithElicitation(
        round,
        { name: "approve", arguments: args },
        "modern",
        "approve"
      );
      return { done: true };
    })
    .addEdge(START, "call")
    .addEdge("call", END)
    .compile({ checkpointer: new MemorySaver() });
}

const pending = (snapshot: {
  tasks: readonly { interrupts?: readonly Interrupt<unknown>[] }[];
}) => snapshot.tasks.flatMap((task) => [...(task.interrupts ?? [])]);

describe("resuming never applies an answer to the wrong question", () => {
  it.each(SEEDS)("rejects near-miss resumes (seed %i)", async (seed) => {
    const random = rng(seed);
    const served: unknown[] = [];

    const round: Round = async (params) => {
      served.push(params.inputResponses);
      if (params.inputResponses) return completed;
      return {
        resultType: "input_required" as const,
        requestState: "opaque",
        inputRequests: { confirmation: question("approve $10") },
      };
    };

    const graph = graphFor(round);
    const config = { configurable: { thread_id: `near-miss-${seed}` } };
    await graph.invoke({ done: false }, config);

    const [raised] = pending(await graph.getState(config));
    const valid = createMCPElicitationResume(raised, {
      confirmation: accepted,
    });
    const [[id, body]] = Object.entries(valid);

    // Each mutation keeps the resume plausible and breaks exactly one thing.
    const corrupt = pick(random, [
      () => ({ [id]: { ...body, responses: {} } }),
      () => ({ [id]: { ...body, responses: { wrong: accepted } } }),
      () => ({
        [id]: {
          ...body,
          responses: { confirmation: accepted, extra: accepted },
        },
      }),
      () => ({
        [id]: {
          ...body,
          responses: { confirmation: { action: "sideways" } },
        },
      }),
      () => ({
        [id]: {
          ...body,
          responses: {
            confirmation: { action: "accept", content: { confirm: "yes" } },
          },
        },
      }),
      () => ({
        [id]: {
          ...body,
          question: { ...body.question, tool: "something-else" },
        },
      }),
      () => ({ [id]: { responses: body.responses } }),
      () => ({ [id]: body.responses }),
      () => ({ [id]: null }),
      () => ({ [id]: "not an answer" }),
    ])();

    await expect(
      graph.invoke(new Command({ resume: corrupt }), config),
      `seed ${seed} accepted a resume it should have refused`
    ).rejects.toSatisfy(isToolException);

    // The refused run must not have reached the server with an answer.
    expect(served.filter(Boolean)).toEqual([]);
  });
});

describe("question identity is order-blind but content-sensitive", () => {
  it.each(SEEDS)(
    "accepts a reordered question and refuses a changed one (seed %i)",
    async (seed) => {
      const random = rng(seed);
      const reorder = random() < 0.5;

      const round: Round = async (params) => {
        if (params.inputResponses) return completed;
        return {
          resultType: "input_required" as const,
          requestState: "opaque",
          inputRequests: {
            // Reordered: same question, `properties` emitted the other way
            // round. Changed: a different amount under the same schema.
            confirmation: reorder
              ? question("approve $10", true)
              : question("approve $1,000"),
          },
        };
      };

      // The human always sees, and answers, "approve $10".
      const seen = {
        type: "mcp_elicitation" as const,
        server: "modern",
        tool: "approve",
        arguments: { label: "operation" },
        requests: { confirmation: question("approve $10").params },
      };

      const graph = graphFor(round);
      const config = { configurable: { thread_id: `identity-${seed}` } };
      await graph.invoke({ done: false }, config);

      const [raised] = pending(await graph.getState(config));
      const resume = {
        [raised.id!]: { question: seen, responses: { confirmation: accepted } },
      };
      const run = graph.invoke(new Command({ resume }), config);

      if (reorder) {
        // Key order is not content: the same question must still be answerable.
        await expect(
          run,
          `seed ${seed} refused a merely reordered question`
        ).resolves.toMatchObject({ done: true });
      } else {
        await expect(
          run,
          `seed ${seed} applied consent to a changed question`
        ).rejects.toSatisfy(isToolException);
      }
    }
  );
});

describe("the round loop always terminates", () => {
  it.each(SEEDS)("ends in a result or a refusal (seed %i)", async (seed) => {
    const random = rng(seed);
    const script = Array.from({ length: 1 + Math.floor(random() * 6) }, () =>
      pick(random, [
        "elicit",
        "elicit",
        "state-only",
        "sampling",
        "roots",
        "result",
      ] as const)
    );

    let step = 0;
    const round: Round = async () => {
      const action = script[Math.min(step++, script.length - 1)];

      if (action === "result") return completed;
      if (action === "state-only")
        return {
          resultType: "input_required" as const,
          requestState: "opaque",
          inputRequests: {},
        };
      if (action === "sampling" || action === "roots")
        return {
          resultType: "input_required",
          requestState: "opaque",
          // Deliberately a request the adapter must refuse, so it is built
          // as the wire would send it rather than as the client types it.
          inputRequests: {
            ask: {
              method:
                action === "sampling" ? "sampling/createMessage" : "roots/list",
              params: {},
            },
          } as unknown as InputRequiredResult["inputRequests"],
        };

      return {
        resultType: "input_required" as const,
        requestState: "opaque",
        inputRequests: { confirmation: question(`round ${step}`) },
      };
    };

    const graph = graphFor(round);
    const config = { configurable: { thread_id: `terminates-${seed}` } };

    // Answer every question the script raises. The budget is gone, so the
    // only thing bounding this is the script itself — that is the property.
    let outcome: "done" | "refused" | undefined;
    let resumes = 0;
    let next: unknown = { done: false };

    while (outcome === undefined) {
      try {
        await graph.invoke(next as never, config);
      } catch (error) {
        expect(
          isToolException(error),
          `seed ${seed} threw something that is not a ToolException: ${String(error)}`
        ).toBe(true);
        outcome = "refused";
        break;
      }

      const raised = pending(await graph.getState(config));
      if (raised.length === 0) {
        outcome = "done";
        break;
      }

      expect(
        (resumes += 1),
        `seed ${seed} kept asking past the length of its own script`
      ).toBeLessThanOrEqual(script.length + 1);

      next = new Command({
        resume: createMCPElicitationResume(raised[0], {
          confirmation: accepted,
        }),
      });
    }

    expect(outcome, `seed ${seed} neither completed nor refused`).toBeDefined();
  });
});
