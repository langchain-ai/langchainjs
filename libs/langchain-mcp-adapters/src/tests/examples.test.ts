import { spawn, type ChildProcess } from "node:child_process";
import {
  Client,
  SSEClientTransport,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import { expect, it } from "vitest";

const fixture = new URL("./fixtures/example-server.ts", import.meta.url);

type Example = "calculator";

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
