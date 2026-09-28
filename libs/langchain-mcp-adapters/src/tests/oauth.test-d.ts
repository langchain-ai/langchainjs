import { expectTypeOf, test } from "vitest";
import { MCPAdapter, UnauthorizedError, type AuthProvider } from "../index.js";

test("authProvider accepts both SDK provider shapes", () => {
  expectTypeOf<{
    token: () => Promise<string>;
  }>().toExtend<AuthProvider>();

  new MCPAdapter({
    servers: {
      a: {
        transport: "http",
        url: "http://127.0.0.1/mcp",
        authProvider: { token: async () => "t" },
      },
    },
  });
});

test("UnauthorizedError is the exported auth check", () => {
  expectTypeOf(UnauthorizedError.isInstance).toBeFunction();
});
