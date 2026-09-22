import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

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

describe("durable rounds", () => {
  it("answers the saved question without repeating its request", async () => {
    const { agent, server, config } = await environment();

    const first = await agent.invoke(input, config);
    // Nothing is answered yet: one request, paused on the question.
    expect(server.calls).toEqual([{ tool: "ask", label: "q", round: 0 }]);

    await agent.invoke(
      resuming(createMCPElicitationResume(onlyInterrupt(first), accept())),
      config
    );

    expect(server.calls).toEqual([
      { tool: "ask", label: "q", round: 0 },
      { tool: "ask", label: "q", round: 1, action: "accept" },
    ]);
    expect(server.completed).toEqual([{ label: "q", action: "accept" }]);
  });

  it("retrieves earlier completed rounds across a multi-round elicitation", async () => {
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

    expect(server.calls).toEqual([
      { tool: "ask", label: "r", round: 0 },
      { tool: "ask", label: "r", round: 1, action: "accept" },
      { tool: "ask", label: "r", round: 2, action: "accept" },
    ]);
    expect(server.completed).toEqual([{ label: "r", action: "accept" }]);
  });
});

describe("process recovery", () => {
  const day = 24 * 60 * 60 * 1000;

  async function processEnvironment(
    serverOptions: Parameters<typeof startAgentMcpServer>[0] = {},
    settings: { rounds?: number; maxRounds?: number } = {}
  ) {
    const server = await startAgentMcpServer(serverOptions);
    cleanups.push(() => server.close());
    const directory = await mkdtemp(join(tmpdir(), "mcp-agent-recovery-"));
    cleanups.push(() => rm(directory, { recursive: true, force: true }));
    const args = [
      "--import",
      "tsx",
      join(__dirname, "fixtures", "durable-agent.ts"),
      server.url,
      join(directory, "checkpoint.bin"),
    ];
    const execute = promisify(execFile);
    return {
      server,
      async run(resume?: MCPElicitationResume, maxRounds = settings.maxRounds) {
        const result = await execute(
          process.execPath,
          [
            ...args,
            resume ? JSON.stringify(resume) : "",
            JSON.stringify({ ...settings, maxRounds }),
          ],
          { timeout: 30_000 }
        );
        return JSON.parse(result.stdout) as unknown;
      },
    };
  }

  it("resumes in a new process after three simulated days within server validity", async () => {
    const { server, run } = await processEnvironment({
      continuationLifetimeMs: 7 * day,
    });
    const pending = onlyInterrupt(await run());
    expect(server.calls).toEqual([{ tool: "ask", label: "restart", round: 0 }]);

    server.advanceTime(3 * day);
    const done = await run(createMCPElicitationResume(pending, accept()));

    expect(mcpInterrupts(done)).toHaveLength(0);
    expect(JSON.stringify(done)).toContain("restart:accept");
    expect(server.calls).toEqual([
      { tool: "ask", label: "restart", round: 0 },
      { tool: "ask", label: "restart", round: 1, action: "accept" },
    ]);
    expect(server.continuations).toEqual(["restart:1"]);
    expect(server.completed).toEqual([{ label: "restart", action: "accept" }]);
  }, 60_000);

  it("reports an expired continuation without restarting or performing the action", async () => {
    const { server, run } = await processEnvironment({
      continuationLifetimeMs: day,
    });
    const pending = onlyInterrupt(await run());

    server.advanceTime(3 * day);
    await expect(
      run(createMCPElicitationResume(pending, accept()))
    ).rejects.toThrow("Invalid or expired requestState");
    expect(server.continuations).toEqual(["restart:1"]);
    expect(server.calls).toEqual([{ tool: "ask", label: "restart", round: 0 }]);
    expect(server.completed).toEqual([]);
    expect(server.accepted).toEqual([]);
  }, 60_000);

  it.each([true, false])(
    "reconstructs the original allowance through four processes: last answer valid=%s",
    async (valid) => {
      const { server, run } = await processEnvironment(
        {},
        { rounds: 2, maxRounds: 3 }
      );
      const first = onlyInterrupt(await run());
      const invalid: MCPElicitationResponses = {
        confirmation: { action: "accept", content: {} },
      };
      const correction = onlyInterrupt(
        await run(createMCPElicitationResume(first, invalid))
      );
      expect(correction.value).toMatchObject({
        questionId: (first.value as { questionId: string }).questionId,
        attempt: 2,
        validationError: expect.any(String),
      });
      expect(server.calls).toHaveLength(1);

      const next = onlyInterrupt(
        await run(createMCPElicitationResume(correction, accept()))
      );
      expect(next.value).toMatchObject({ attempt: 3 });
      expect(server.calls).toHaveLength(2);

      const done = await run(
        createMCPElicitationResume(next, valid ? accept() : invalid),
        32
      );
      expect(mcpInterrupts(done)).toHaveLength(0);
      if (valid) {
        expect(JSON.stringify(done)).toContain("restart:accept");
        expect(server.calls).toHaveLength(3);
        expect(server.completed).toEqual([
          { label: "restart", action: "accept" },
        ]);
      } else {
        expect(JSON.stringify(done)).toContain(
          "exceeded 3 elicitation rounds while correcting an answer"
        );
        expect(server.calls).toHaveLength(2);
        expect(server.completed).toEqual([]);
      }
      expect(
        server.calls.filter((call) => call.tool === "ask" && call.round === 0)
      ).toHaveLength(1);
    },
    120_000
  );
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

    expect(server.calls).toEqual([{ tool: "ask", label: "q", round: 0 }]);
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
