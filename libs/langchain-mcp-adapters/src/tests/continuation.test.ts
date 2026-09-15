import {
  InterruptMCPClient,
  PendingMCPInput,
  withMCPInterrupts,
} from "../continuation.js";
import {
  Client,
  StreamableHTTPClientTransport,
  specTypeSchemas,
  withInputRequired,
  isInputRequiredResult,
} from "@modelcontextprotocol/client";
import { createServer } from "node:http";
import { once } from "node:events";
import {
  createMcpHandler,
  inputRequired,
  McpServer,
} from "@modelcontextprotocol/server";
import { toNodeHandler } from "@modelcontextprotocol/node";
import { z } from "zod";
import { expect, it, vi } from "vitest";
import { MCPAdapter } from "../index.js";

it.each(["state-only", "limit", "abort", "transport"])(
  "bounds direct continuation without user questions: %s",
  async (scenario) => {
    const controller = new AbortController();
    let calls = 0;
    const invocation = withMCPInterrupts(
      async (continuation) => {
        calls += 1;
        if (scenario === "transport") {
          throw new Error("transport failure");
        }
        if (continuation) {
          expect(continuation.requestState).toBe("opaque-state");
          expect(continuation.inputResponses).toEqual({});
          if (scenario === "state-only") {
            return "done";
          }
        }
        if (scenario === "abort") {
          controller.abort();
        }
        throw new PendingMCPInput(
          {
            kind: "input_required",
            inputRequests: {},
            requestState: "opaque-state",
          },
          { name: "tool", arguments: {} }
        );
      },
      {
        server: "test",
        tool: "tool",
        maxRounds: 2,
        signal: controller.signal,
        execution: "direct",
      }
    );
    if (scenario === "state-only") {
      expect(await invocation).toBe("done");
      expect(calls).toBe(2);
    } else {
      await expect(invocation).rejects.toThrow(
        scenario === "limit"
          ? /round limit/
          : scenario === "transport"
            ? /transport/
            : /abort/i
      );
      expect(calls).toBe(scenario === "limit" ? 3 : 1);
    }
  }
);

it.each([true, false])(
  "preserves output validation across manual continuation: %s",
  async (validOutput) => {
    const handler = createMcpHandler(
      () => {
        const server = new McpServer({
          name: "continuation-probe",
          version: "1",
        });

        server.registerTool(
          "confirm",
          {
            inputSchema: z.object({}),
            outputSchema: z.object({ confirmed: z.boolean() }),
          },
          async () => ({ content: [] })
        );
        // Deliberately bypass server-side output validation to exercise the client boundary.
        server.server.setRequestHandler("tools/call", async (_, context) =>
          context.mcpReq.inputResponses?.confirm
            ? {
                content: [{ type: "text", text: "confirmed" }],
                structuredContent: {
                  confirmed: validOutput ? true : "invalid",
                },
              }
            : inputRequired({
                inputRequests: {
                  confirm: inputRequired.elicit({
                    message: "Confirm?",
                    requestedSchema: {
                      type: "object",
                      properties: { confirmed: { type: "boolean" } },
                      required: ["confirmed"],
                    },
                  }),
                },
              })
        );

        return server;
      },
      { legacy: "reject" }
    );

    const http = createServer(toNodeHandler(handler));
    http.listen(0, "127.0.0.1");
    await once(http, "listening");
    const address = http.address();

    if (!address || typeof address === "string")
      throw new Error("Missing address");

    const client = new Client(
      { name: "probe", version: "1" },
      {
        versionNegotiation: { mode: "auto" },
        capabilities: { elicitation: { form: {} } },
      }
    );

    try {
      await client.connect(
        new StreamableHTTPClientTransport(
          new URL(`http://127.0.0.1:${address.port}`)
        )
      );
      expect(client.getProtocolEra()).toBe("modern");
      await client.listTools();
      await expect(
        client.callTool(
          { name: "confirm", arguments: {} },
          { allowInputRequired: true }
        )
      ).rejects.toThrow(/output schema but did not return structured content/);

      const round = await client.request(
        { method: "tools/call", params: { name: "confirm", arguments: {} } },
        withInputRequired(specTypeSchemas.CallToolResult),
        { allowInputRequired: true }
      );

      expect(isInputRequiredResult(round)).toBe(true);

      const interruptClient = new InterruptMCPClient(
        { name: "interrupt-probe", version: "1" },
        {
          versionNegotiation: { mode: "auto" },
          capabilities: { elicitation: { form: {} } },
        }
      );

      try {
        await interruptClient.connect(
          new StreamableHTTPClientTransport(
            new URL(`http://127.0.0.1:${address.port}`)
          )
        );
        await interruptClient.listTools();
        await expect(
          interruptClient.callTool({ name: "confirm", arguments: {} })
        ).rejects.toBeInstanceOf(PendingMCPInput);

        const params = {
          name: "confirm",
          arguments: {},
          inputResponses: {
            confirm: { action: "accept", content: { confirmed: true } },
          },
        };

        if (validOutput) {
          const result = await interruptClient.callTool(params);
          expect(result.structuredContent).toEqual({ confirmed: true });
        } else {
          await expect(interruptClient.callTool(params)).rejects.toThrow();
        }
      } finally {
        await interruptClient.close();
      }
    } finally {
      await client.close();
      await handler.close();
      http.close();
      http.closeAllConnections();
      await once(http, "close");
    }
  }
);

it("recognizes pending input across adapter copies without matching lookalikes", async () => {
  const pending = {
    kind: "input_required",
    inputRequests: {},
  } satisfies ConstructorParameters<typeof PendingMCPInput>[0];

  const request = { name: "confirm", arguments: {} };
  const original = new PendingMCPInput(pending, request);
  vi.resetModules();
  const duplicate = await import("../continuation.js");

  expect(duplicate.PendingMCPInput).not.toBe(PendingMCPInput);
  expect(duplicate.PendingMCPInput.isInstance(original)).toBe(true);
  expect(
    PendingMCPInput.isInstance(new duplicate.PendingMCPInput(pending, request))
  ).toBe(true);
  expect(PendingMCPInput.isInstance({ pending, request })).toBe(false);
  expect(PendingMCPInput.isInstance(new Error("MCP tool requires input"))).toBe(
    false
  );
});

it("retains per-call headers across direct rounds without sharing them between invocations", async () => {
  const observed: { account: string; header: string; parameter: string }[] = [];

  const handler = createMcpHandler(
    (request) => {
      const server = new McpServer(
        { name: "header-continuation", version: "1" },
        {
          requestState: {
            verify: async (state) => ({ account: z.string().parse(state) }),
          },
        }
      );

      server.registerTool(
        "account",
        {
          inputSchema: z.object({
            account: z.string().meta({ "x-mcp-header": "Account" }),
          }),
        },
        async ({ account }, context) => {
          const header =
            request.requestInfo?.headers.get("x-test-account") ?? "missing";

          observed.push({
            account,
            header,
            parameter:
              request.requestInfo?.headers.get("mcp-param-account") ??
              "missing",
          });

          if (!context.mcpReq.inputResponses) {
            return inputRequired({ requestState: account, inputRequests: {} });
          }

          expect(context.mcpReq.requestState()).toEqual({ account });

          return { content: [{ type: "text", text: header }] };
        }
      );

      return server;
    },
    { legacy: "reject" }
  );

  const http = createServer(toNodeHandler(handler));
  http.listen(0, "127.0.0.1");
  await once(http, "listening");
  const { port } = z.object({ port: z.number() }).parse(http.address());

  const before = vi.fn(({ args }) =>
    args.account === "default"
      ? undefined
      : {
          args: { account: `${z.string().parse(args.account)}-effective` },
          headers: {
            "X-Test-Account": `${z.string().parse(args.account)}-effective`,
          },
        }
  );

  const after = vi.fn();

  const adapter = new MCPAdapter({
    servers: {
      server: {
        url: `http://127.0.0.1:${port}/mcp`,
        headers: { "X-Test-Account": "default" },
      },
    },
    beforeToolCall: before,
    afterToolCall: after,
  });

  try {
    const [tool] = await adapter.listTools();
    await expect(
      Promise.all([
        tool.invoke({ account: "alpha" }),
        tool.invoke({ account: "beta" }),
      ])
    ).resolves.toEqual(["alpha-effective", "beta-effective"]);
    await expect(tool.invoke({ account: "default" })).resolves.toBe("default");

    for (const account of ["alpha-effective", "beta-effective", "default"]) {
      expect(observed.filter((call) => call.account === account)).toEqual([
        { account, header: account, parameter: account },
        { account, header: account, parameter: account },
      ]);
    }

    expect(before).toHaveBeenCalledTimes(3);
    expect(after).toHaveBeenCalledTimes(3);
  } finally {
    await adapter.close();
    http.close();
    http.closeAllConnections();
    await once(http, "close");
  }
});
