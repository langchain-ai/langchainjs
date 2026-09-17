import { randomUUID } from "node:crypto";

import { Command, MemorySaver, type Interrupt } from "@langchain/langgraph";
import { createAgent, FakeToolCallingModel } from "langchain";
import { afterEach, describe, expect, it } from "vitest";

import { MCPAdapter, createMCPElicitationResume } from "../index.js";
import type {
  MCPElicitationResponses,
  MCPElicitationResume,
} from "../continuation.js";
import {
  startAgentMcpServer,
  type AgentMcpServer,
} from "./fixtures/agent-mcp-servers.js";

const cleanups: (() => Promise<void> | void)[] = [];

afterEach(async () => {
  while (cleanups.length) await cleanups.pop()?.();
});

type Interrupted = { __interrupt__?: Interrupt<unknown>[] };
type ToolCall = { id: string; name: string; args: Record<string, unknown> };

function mcpInterrupts(result: unknown): Interrupt<unknown>[] {
  return (
    (result as Interrupted).__interrupt__?.filter(
      (interrupt) =>
        typeof interrupt.value === "object" &&
        interrupt.value !== null &&
        "type" in interrupt.value &&
        interrupt.value.type === "mcp_elicitation"
    ) ?? []
  );
}

function onlyInterrupt(result: unknown): Interrupt<unknown> {
  const pending = mcpInterrupts(result);
  if (pending.length !== 1)
    throw new Error(`Expected one MCP interrupt, saw ${pending.length}`);
  return pending[0];
}

function accept(): MCPElicitationResponses {
  return { confirmation: { action: "accept", content: { confirm: true } } };
}

/**
 * Resume params answering only the question raised for `label`.
 *
 * `Command` is constructed at each call site so its goto type parameter infers
 * from the agent rather than widening to `string`.
 */
function answeringOnly(pending: Interrupt<unknown>[], label: string) {
  const target = pending.find(
    (interrupt) =>
      (interrupt.value as { requests?: Record<string, { message?: string }> })
        .requests?.confirmation?.message === label
  );
  if (!target) throw new Error(`No pending MCP question for ${label}`);
  return resuming(createMCPElicitationResume(target, accept()));
}

async function environment(toolCalls?: ToolCall[][]) {
  const server: AgentMcpServer = await startAgentMcpServer();
  cleanups.push(() => server.close());

  const adapter = new MCPAdapter({ servers: { modern: { url: server.url } } });
  cleanups.push(() => adapter.close());

  const agent = createAgent({
    model: new FakeToolCallingModel({
      toolCalls: toolCalls ?? [
        [{ id: "c1", name: "ask", args: { label: "q" } }],
        [],
      ],
    }),
    tools: await adapter.listTools(),
    checkpointer: new MemorySaver(),
  });

  return {
    agent,
    server,
    config: { configurable: { thread_id: randomUUID() } },
  };
}

const input = { messages: [{ role: "user" as const, content: "go" }] };

type AgentUnderTest = Awaited<ReturnType<typeof environment>>["agent"];
type AgentInput = Parameters<AgentUnderTest["invoke"]>[0];

/**
 * Hand a resume `Command` to the agent.
 *
 * `langchain` and this package both depend on `@langchain/langgraph@1.4.13`,
 * but the lockfile resolves them under different `zod` peers (`4.3.6` and
 * `4.4.3`), so pnpm installs two instances. Their `Command` classes are the
 * same class at runtime and distinct nominal types to the compiler, which
 * rejects the branded `[COMMAND_SYMBOL]` across the boundary. The cast is
 * confined to this helper rather than spread across the tests.
 */
function resuming(resume: MCPElicitationResume): AgentInput {
  return new Command({ resume }) as unknown as AgentInput;
}

describe("replay on resume", () => {
  it("replays the initial request, then answers it with that response's state", async () => {
    const { agent, server, config } = await environment();

    const first = await agent.invoke(input, config);
    // Nothing is answered yet: one request, paused on the question.
    expect(server.calls).toEqual([{ tool: "ask", label: "q", round: 0 }]);

    await agent.invoke(
      resuming(createMCPElicitationResume(onlyInterrupt(first), accept())),
      config
    );

    // Resuming re-runs the tool node from the top: the initial request is
    // issued again, and only then is the answered follow-up sent, carrying the
    // requestState returned by the response this execution just replayed.
    expect(server.calls).toEqual([
      { tool: "ask", label: "q", round: 0 },
      { tool: "ask", label: "q", round: 0 },
      { tool: "ask", label: "q", round: 1, action: "accept" },
    ]);
    expect(server.completed).toEqual([{ label: "q", action: "accept" }]);
  });

  it("replays earlier answered rounds across a multi-round elicitation", async () => {
    const { agent, server, config } = await environment([
      [{ id: "c1", name: "ask", args: { label: "r", rounds: 2 } }],
      [],
    ]);

    const first = await agent.invoke(input, config);
    const second = await agent.invoke(
      resuming(createMCPElicitationResume(onlyInterrupt(first), accept())),
      config
    );
    await agent.invoke(
      resuming(createMCPElicitationResume(onlyInterrupt(second), accept())),
      config
    );

    // The second resume replays round 0 and round 1 before reaching round 2.
    // Pre-elicitation work repeats; the adapter promises no exactly-once
    // effects. Each round's state comes from the response preceding it in the
    // same execution, so the rounds still advance 0 -> 1 -> 2.
    expect(server.calls).toEqual([
      { tool: "ask", label: "r", round: 0 },
      { tool: "ask", label: "r", round: 0 },
      { tool: "ask", label: "r", round: 1, action: "accept" },
      { tool: "ask", label: "r", round: 0 },
      { tool: "ask", label: "r", round: 1, action: "accept" },
      { tool: "ask", label: "r", round: 2, action: "accept" },
    ]);
    expect(server.completed).toEqual([{ label: "r", action: "accept" }]);
  });
});

describe("answer validation", () => {
  it("re-interrupts with a validation error, then accepts a correction", async () => {
    const { agent, server, config } = await environment();

    const first = await agent.invoke(input, config);
    const corrected = await agent.invoke(
      resuming(
        createMCPElicitationResume(onlyInterrupt(first), {
          // `confirm` is declared boolean by the server's requestedSchema.
          confirmation: { action: "accept", content: { confirm: "yes" } },
        } as unknown as MCPElicitationResponses)
      ),
      config
    );

    // The malformed answer never reaches the server: the replayed initial
    // request is the only call it saw.
    expect(server.calls).toEqual([
      { tool: "ask", label: "q", round: 0 },
      { tool: "ask", label: "q", round: 0 },
    ]);
    expect(onlyInterrupt(corrected).value).toMatchObject({
      type: "mcp_elicitation",
      validationError: expect.stringContaining("must be boolean"),
    });

    await agent.invoke(
      resuming(createMCPElicitationResume(onlyInterrupt(corrected), accept())),
      config
    );

    expect(server.calls.at(-1)).toEqual({
      tool: "ask",
      label: "q",
      round: 1,
      action: "accept",
    });
    expect(server.completed).toEqual([{ label: "q", action: "accept" }]);
  });

  it("rejects an answer under the wrong request key", async () => {
    const { agent, config } = await environment();

    const first = await agent.invoke(input, config);
    const retried = await agent.invoke(
      resuming(
        createMCPElicitationResume(onlyInterrupt(first), {
          wrong: { action: "accept", content: { confirm: true } },
        })
      ),
      config
    );

    expect(onlyInterrupt(retried).value).toMatchObject({
      validationError: expect.any(String),
    });
  });
});

describe("answer targeting", () => {
  it("answers one parallel question without answering its sibling", async () => {
    const { agent, server, config } = await environment([
      [
        { id: "a", name: "ask", args: { label: "alpha" } },
        { id: "b", name: "ask", args: { label: "beta" } },
      ],
      [],
    ]);

    const first = await agent.invoke(input, config);
    expect(mcpInterrupts(first)).toHaveLength(2);

    // Targeting by interrupt ID answers alpha and leaves beta pending.
    const second = await agent.invoke(
      answeringOnly(mcpInterrupts(first), "alpha"),
      config
    );
    expect(
      server.completed.map((entry) => entry.label).filter((l) => l === "beta")
    ).toEqual([]);

    const stillPending = mcpInterrupts(second);
    expect(stillPending).toHaveLength(1);

    await agent.invoke(answeringOnly(stillPending, "beta"), config);

    expect([...server.completed].map((entry) => entry.label).sort()).toEqual([
      "alpha",
      "beta",
    ]);
  });
});
