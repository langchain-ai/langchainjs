import { vi } from "vitest";

// Set up mocks for external modules
vi.mock("@modelcontextprotocol/sdk/client/index.js", () => {
  const clientPrototype = {
    connect: vi.fn().mockReturnValue(Promise.resolve()),
    listTools: vi.fn().mockReturnValue(
      Promise.resolve({
        tools: [
          {
            name: "tool1",
            description: "Test tool 1",
            inputSchema: { type: "object", properties: {} },
          },
          {
            name: "tool2",
            description: "Test tool 2",
            inputSchema: { type: "object", properties: {} },
          },
        ],
      })
    ),
    callTool: vi
      .fn()
      .mockReturnValue(
        Promise.resolve({ content: [{ type: "text", text: "result" }] })
      ),
    close: vi.fn().mockImplementation(() => Promise.resolve()),
    tools: [], // Add the tools property
  };
  const Client = vi.fn().mockImplementation(() => clientPrototype);
  Client.prototype = clientPrototype;
  return {
    Client,
  };
});

vi.mock("@modelcontextprotocol/sdk/client/stdio.js", () => {
  const stdioClientTransportPrototype = {
    connect: vi.fn().mockReturnValue(Promise.resolve()),
    send: vi.fn().mockReturnValue(Promise.resolve()),
    close: vi.fn().mockReturnValue(Promise.resolve()),
  };
  const StdioClientTransport = vi.fn().mockImplementation((config) => {
    return {
      ...stdioClientTransportPrototype,
      config,
    };
  });
  StdioClientTransport.prototype = stdioClientTransportPrototype;
  return {
    StdioClientTransport,
  };
});

vi.mock("@modelcontextprotocol/sdk/client/sse.js", () => {
  const sseClientTransportPrototype = {
    connect: vi.fn().mockReturnValue(Promise.resolve()),
    send: vi.fn().mockReturnValue(Promise.resolve()),
    close: vi.fn().mockReturnValue(Promise.resolve()),
  };
  const SSEClientTransport = vi.fn().mockImplementation((config) => {
    return {
      ...sseClientTransportPrototype,
      config,
    };
  });
  SSEClientTransport.prototype = sseClientTransportPrototype;
  return {
    SSEClientTransport,
  };
});

vi.mock("@modelcontextprotocol/sdk/client/streamableHttp.js", () => {
  const streamableHTTPClientTransportPrototype = {
    connect: vi.fn().mockReturnValue(Promise.resolve()),
    send: vi.fn().mockReturnValue(Promise.resolve()),
    close: vi.fn().mockReturnValue(Promise.resolve()),
  };
  const StreamableHTTPClientTransport = vi.fn().mockImplementation((config) => {
    return {
      ...streamableHTTPClientTransportPrototype,
      config,
    };
  });
  StreamableHTTPClientTransport.prototype = streamableHTTPClientTransportPrototype;
  return {
    StreamableHTTPClientTransport,
  };
});
