/**
 * Elicitation through a real agent.
 *
 * `interrupts.test.ts` drives the adapter from a one-node graph and owns the
 * protocol surface: refusals, answer parsing, headers, and real stdio servers.
 * This file exists only for what needs an actual agent turn — `ToolNode`
 * fanning several tool calls out at once, and a call whose rounds outlive one
 * resume.
 */
import { randomUUID } from "node:crypto";

import { Command, MemorySaver, type Interrupt } from "@langchain/langgraph";
import { createAgent, FakeToolCallingModel } from "langchain";
import { afterEach, describe, expect, it } from "vitest";

import { MCPAdapter, createMCPElicitationResume } from "../index.js";
import type {
  MCPElicitationResponses,
  MCPElicitationResume,
} from "../elicitation.js";
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

  const adapter = new MCPAdapter({
    servers: { modern: { url: server.url, elicitation: true } },
  });
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

describe("multiple sequential rounds", () => {
  it("answers each question and replays the answered ones", async () => {
    const { agent, server, config } = await environment([
      [{ id: "c1", name: "ask", args: { label: "q", rounds: 2 } }],
      [],
    ]);

    const first = await agent.invoke(input, config);
    expect(mcpInterrupts(first)).toHaveLength(1);

    const second = await agent.invoke(
      resuming(createMCPElicitationResume(onlyInterrupt(first), accept())),
      config
    );
    expect(mcpInterrupts(second)).toHaveLength(1);

    const done = await agent.invoke(
      resuming(createMCPElicitationResume(onlyInterrupt(second), accept())),
      config
    );

    expect(mcpInterrupts(done)).toHaveLength(0);
    expect(server.completed).toEqual([{ label: "q", action: "accept" }]);

    // Both questions carry the same message, so they are indistinguishable.
    // The answers still land in order, because LangGraph matches resumes to
    // `interrupt()` calls positionally within the task — and two questions
    // with identical content have interchangeable answers anyway.
    //
    // Each resume replays every answered round before reaching the new one,
    // so N questions cost O(N^2) requests. This is the price of not
    // checkpointing the server's continuation.
    expect(server.calls.map((call) => call.round)).toEqual([0, 0, 1, 0, 1, 2]);
  });
});
