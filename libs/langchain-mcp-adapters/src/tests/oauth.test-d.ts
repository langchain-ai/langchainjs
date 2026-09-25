import { expectTypeOf, test } from "vitest";
import {
  MCPAdapter,
  UnauthorizedError,
  type AuthProvider,
  type FinishAuthOptions,
  type OAuthClientProvider,
} from "../index.js";

test("authProvider accepts both SDK provider shapes", () => {
  expectTypeOf<{
    token: () => Promise<string>;
  }>().toMatchTypeOf<AuthProvider>();

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

test("finishAuth takes the callback query and optional FinishAuthOptions", () => {
  expectTypeOf<MCPAdapter["finishAuth"]>()
    .parameter(1)
    .toEqualTypeOf<URLSearchParams>();
  expectTypeOf<MCPAdapter["finishAuth"]>().returns.toEqualTypeOf<
    Promise<void>
  >();
  expectTypeOf<FinishAuthOptions>().toMatchTypeOf<{
    authProvider?: OAuthClientProvider;
    expectedState?: string;
  }>();
});

test("UnauthorizedError is the exported auth check", () => {
  expectTypeOf(UnauthorizedError.isInstance).toBeFunction();
});
