import { expectTypeOf, test } from "vitest";
import type {
  AuthProvider,
  OAuthClientProvider,
  StreamableHTTPConnection,
} from "../index.js";

test("authProvider accepts both exported SDK provider types", () => {
  type Accepted = NonNullable<StreamableHTTPConnection["authProvider"]>;
  expectTypeOf<AuthProvider>().toExtend<Accepted>();
  expectTypeOf<OAuthClientProvider>().toExtend<Accepted>();
});
