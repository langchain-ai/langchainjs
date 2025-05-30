// src/tests/multiclient.test.ts
import { test } from "@jest/globals";
import { MultiServerMCPClient } from "../client.js";

test("Construct MultiServerMCPClient", async () => {
  const client = new MultiServerMCPClient({
    mcpServers: {
      math: {
        transport: "stdio",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-math"],
      },
    },
  });

  expect(client).toBeDefined();

  await client.close();
});
