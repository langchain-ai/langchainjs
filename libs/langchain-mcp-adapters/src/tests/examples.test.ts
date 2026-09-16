import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import {
  Client,
  SSEClientTransport,
  StreamableHTTPClientTransport,
  isInputRequiredResult,
  specTypeSchemas,
  withInputRequired,
} from "@modelcontextprotocol/client";
import { expect, it } from "vitest";

const fixture = new URL("./fixtures/example-server.ts", import.meta.url);

type Example = "calculator" | "modern";

async function stopExample(
  child: ChildProcess,
  closed: Promise<void>,
  signal: NodeJS.Signals = "SIGTERM"
) {
  // These deadlines bound real subprocess shutdown; fake timers cannot drive OS signals.
  const force = setTimeout(() => child.kill("SIGKILL"), 2_000);
  try {
    if (child.pid && child.exitCode === null && child.signalCode === null) {
      child.kill(signal);
    }
    await closed;
  } finally {
    clearTimeout(force);
  }
}

async function startExample(name: Example) {
  const child = spawn(
    process.execPath,
    ["--import", "tsx", fixture.pathname, name],
    {
      stdio: ["ignore", "pipe", "pipe"],
    }
  );
  const closed = new Promise<void>((resolve) => {
    child.once("close", () => resolve());
  });
  let clearReadiness = () => {};
  try {
    const baseUrl = await new Promise<string>((resolve, reject) => {
      let output = "";
      // Readiness is an OS process event; this deadline bounds startup failures.
      const timeout = setTimeout(() => {
        reject(new Error(`Timed out starting ${name}: ${output}`));
      }, 10_000);
      const onData = (chunk: Buffer) => {
        output = `${output}${chunk.toString()}`.slice(-16_384);
        const url = output.match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];
        if (url) resolve(url);
      };
      const onErrorData = (chunk: Buffer) => {
        output = `${output}${chunk.toString()}`.slice(-16_384);
      };
      const onExit = (code: number | null) => {
        reject(new Error(`${name} exited before ready (${code}): ${output}`));
      };
      child.stdout.on("data", onData);
      child.stderr.on("data", onErrorData);
      child.once("error", reject);
      child.once("exit", onExit);
      clearReadiness = () => {
        clearTimeout(timeout);
        child.stdout.off("data", onData);
        child.stderr.off("data", onErrorData);
        child.off("error", reject);
        child.off("exit", onExit);
        child.stdout.resume();
        child.stderr.resume();
      };
    });
    return { child, baseUrl, closed };
  } catch (error) {
    await stopExample(child, closed, "SIGKILL");
    throw error;
  } finally {
    clearReadiness();
  }
}

it("serves concurrent streamable HTTP and SSE calculator sessions", async () => {
  const { child, baseUrl, closed } = await startExample("calculator");
  const first = new Client(
    { name: "first", version: "1" },
    { versionNegotiation: { mode: "legacy" } }
  );
  const second = new Client(
    { name: "second", version: "1" },
    { versionNegotiation: { mode: "legacy" } }
  );
  const sse = new Client(
    { name: "sse", version: "1" },
    { versionNegotiation: { mode: "legacy" } }
  );

  const failures: unknown[] = [];
  try {
    await Promise.all([
      first.connect(
        new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`))
      ),
      second.connect(
        new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`))
      ),
      sse.connect(new SSEClientTransport(new URL(`${baseUrl}/sse`))),
    ]);
    const [firstResult, secondResult, sseResult] = await Promise.all([
      first.callTool({ name: "add", arguments: { a: 2, b: 3 } }),
      second.callTool({ name: "add", arguments: { a: 7, b: 8 } }),
      sse.callTool({ name: "add", arguments: { a: 4, b: 6 } }),
    ]);
    expect(firstResult.content).toEqual([{ type: "text", text: "5" }]);
    expect(secondResult.content).toEqual([{ type: "text", text: "15" }]);
    expect(sseResult.content).toEqual([{ type: "text", text: "10" }]);
  } finally {
    for (const client of [first, second, sse]) {
      try {
        await client.close();
      } catch (error) {
        failures.push(error);
      }
    }
    await stopExample(child, closed);
  }
  if (failures.length)
    throw new AggregateError(failures, "Client cleanup failed");
});

it("rejects forged modern phases and preserves approval outcomes", async () => {
  const { child, baseUrl, closed } = await startExample("modern");
  const client = new Client(
    { name: "approval", version: "1" },
    {
      versionNegotiation: { mode: "auto" },
      capabilities: { elicitation: { form: {}, url: {} } },
      inputRequired: { autoFulfill: false },
    }
  );
  const call = (extra: Record<string, unknown> = {}) =>
    client.request(
      {
        method: "tools/call",
        params: { name: "approve", arguments: {}, ...extra },
      },
      withInputRequired(specTypeSchemas.CallToolResult),
      { allowInputRequired: true }
    );
  const round = async (extra: Record<string, unknown> = {}) => {
    const result = await call(extra);
    if (!isInputRequiredResult(result) || !result.requestState) {
      throw new Error("Expected an input-required result");
    }
    return result;
  };
  const text = async (extra: Record<string, unknown> = {}) => {
    const result = await call(extra);
    if (isInputRequiredResult(result) || result.content?.[0]?.type !== "text") {
      throw new Error("Expected a text completion");
    }
    return result.content[0].text;
  };

  try {
    await client.connect(
      new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`))
    );
    await expect(
      call({
        requestState: "authorization",
        inputResponses: { authorization: { action: "accept" } },
      })
    ).rejects.toThrow();

    const declined = await round();
    expect(
      await text({
        requestState: declined.requestState,
        inputResponses: { profile: { action: "decline" } },
      })
    ).toBe("decline");

    const profile = await round();
    const confirmation = await round({
      requestState: profile.requestState,
      inputResponses: {
        profile: { action: "accept", content: { name: "Ada" } },
      },
    });
    expect(
      await text({
        requestState: confirmation.requestState,
        inputResponses: {
          confirmation: { action: "accept", content: { confirm: false } },
        },
      })
    ).toBe("decline");

    const acceptedProfile = await round();
    const acceptedConfirmation = await round({
      requestState: acceptedProfile.requestState,
      inputResponses: {
        profile: { action: "accept", content: { name: "Ada" } },
      },
    });
    const authorization = await round({
      requestState: acceptedConfirmation.requestState,
      inputResponses: {
        confirmation: { action: "accept", content: { confirm: true } },
      },
    });
    expect(
      await text({
        requestState: authorization.requestState,
        inputResponses: { authorization: { action: "accept" } },
      })
    ).toBe("Completed two forms and one URL action");

    const cancelled = await round();
    expect(
      await text({
        requestState: cancelled.requestState,
        inputResponses: { profile: { action: "cancel" } },
      })
    ).toBe("cancel");
  } finally {
    try {
      await client.close();
    } finally {
      await stopExample(child, closed);
    }
  }
});

const elicitationExample = new URL(
  "../../examples/modern_elicitation.ts",
  import.meta.url
);

/** Run the runnable elicitation example against a server on an ephemeral port. */
async function runElicitationExample(baseUrl: string, action: string) {
  const child = spawn(
    process.execPath,
    ["--import", "tsx", elicitationExample.pathname, action],
    {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, MCP_EXAMPLE_URL: `${baseUrl}/mcp` },
    }
  );
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk: Buffer) => {
    stdout = `${stdout}${chunk.toString()}`.slice(-32_768);
  });
  child.stderr.on("data", (chunk: Buffer) => {
    stderr = `${stderr}${chunk.toString()}`.slice(-32_768);
  });
  // This deadline bounds a real subprocess; fake timers cannot drive one.
  const force = setTimeout(() => child.kill("SIGKILL"), 30_000);
  try {
    const [code] = (await once(child, "close")) as [number | null];
    return { code, stdout, stderr };
  } finally {
    clearTimeout(force);
  }
}

it.each([
  { action: "accept", expected: "Completed two forms and one URL action" },
  { action: "decline", expected: "decline" },
  { action: "cancel", expected: "cancel" },
])(
  "runs the createAgent elicitation example with $action",
  async ({ action, expected }) => {
    const { child, baseUrl, closed } = await startExample("modern");
    try {
      const run = await runElicitationExample(baseUrl, action);
      expect(run.code === 0 ? "" : `exit ${run.code}: ${run.stderr}`).toBe("");
      // The example answers each question through a reconstructed adapter, so
      // reaching the result also proves a resume survives losing the client.
      expect(run.stdout).toContain(`Result: ${expected}`);
    } finally {
      await stopExample(child, closed);
    }
  },
  60_000
);
