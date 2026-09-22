import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { Command, MemorySaver, type Interrupt } from "@langchain/langgraph";
import { createAgent, FakeToolCallingModel } from "langchain";
import { afterEach, describe, expect, it, vi } from "vitest";

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

describe("answer validation", () => {
  it("fails the call when an answer violates the requested schema", async () => {
    const { agent, server, config } = await environment();

    const first = await agent.invoke(input, config);

    // Re-asking would not help: the caller resuming the graph is code, not the
    // human who filled the form, so the same question would come back wrong.
    const failed = await agent.invoke(
      resuming(
        createMCPElicitationResume(onlyInterrupt(first), {
          // `confirm` is declared boolean by the server's requestedSchema.
          confirmation: { action: "accept", content: { confirm: "yes" } },
        } as unknown as MCPElicitationResponses)
      ),
      config
    );

    expect(mcpInterrupts(failed)).toHaveLength(0);
    expect(JSON.stringify(failed.messages)).toContain(
      "is invalid: \u2716 data/confirm must be boolean"
    );
    expect(server.completed).toEqual([]);
  });

  it("fails the call for an answer under the wrong request key", async () => {
    const { agent, config } = await environment();

    const first = await agent.invoke(input, config);

    const failed = await agent.invoke(
      resuming(
        createMCPElicitationResume(onlyInterrupt(first), {
          wrong: { action: "accept", content: { confirm: true } },
        })
      ),
      config
    );

    expect(mcpInterrupts(failed)).toHaveLength(0);
    expect(JSON.stringify(failed.messages)).toContain(
      "needs an answer for every elicitation request"
    );
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

/** Tool output text for the single tool call the fake model issues. */
function toolOutput(result: unknown): string {
  const { messages } = result as { messages: { content?: unknown }[] };
  return messages
    .map((message) => message.content)
    .filter((content): content is string => typeof content === "string")
    .join("|");
}

describe("end to end over stdio", () => {
  it("interrupts a modern stdio server, then completes it on resume", async () => {
    const adapter = new MCPAdapter({
      servers: {
        modern: {
          transport: "stdio",
          command: process.execPath,
          args: [
            "--import",
            "tsx",
            join(__dirname, "fixtures", "modern-stdio-server.ts"),
          ],
          elicitation: true,
        },
      },
    });
    cleanups.push(() => adapter.close());

    const tools = await adapter.listTools();
    const agent = createAgent({
      model: new FakeToolCallingModel({
        toolCalls: [[{ id: "c1", name: tools[0].name, args: {} }], []],
      }),
      tools,
      checkpointer: new MemorySaver(),
    });
    const config = { configurable: { thread_id: randomUUID() } };

    const paused = await agent.invoke(input, config);
    const question = onlyInterrupt(paused);
    expect(question.value).toMatchObject({
      type: "mcp_elicitation",
      server: "modern",
      requests: { confirmation: { message: "Approve modern?" } },
    });

    const done = await agent.invoke(
      resuming(createMCPElicitationResume(question, accept())),
      config
    );

    expect(toolOutput(done)).toContain("accept");
  });

  it("answers a legacy stdio server from its callback without interrupting", async () => {
    const onElicitation = vi.fn(() => ({
      action: "accept" as const,
      content: { confirm: true },
    }));

    const adapter = new MCPAdapter({
      servers: {
        legacy: {
          mode: "legacy",
          transport: "stdio",
          command: process.execPath,
          args: [
            "--import",
            "tsx",
            "--no-warnings",
            join(__dirname, "fixtures", "sdk1-stdio-server.ts"),
            "legacy",
            "--elicitation",
          ],
          onElicitation,
        },
      },
    });
    cleanups.push(() => adapter.close());

    const tools = await adapter.listTools();
    const agent = createAgent({
      model: new FakeToolCallingModel({
        toolCalls: [[{ id: "c1", name: tools[0].name, args: {} }], []],
      }),
      tools,
      checkpointer: new MemorySaver(),
    });

    const done = await agent.invoke(input, {
      configurable: { thread_id: randomUUID() },
    });

    // A legacy server asks over a reverse request its own callback answers, so
    // the agent never pauses and the interrupt boundary stays out of the path.
    expect(mcpInterrupts(done)).toHaveLength(0);
    expect(onElicitation).toHaveBeenCalledTimes(1);
    expect(toolOutput(done)).toContain("accept");
  });
});
