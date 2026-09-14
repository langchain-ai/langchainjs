import { expectTypeOf, it } from "vitest";

import {
  createMiddleware,
  omitPayload,
  type AgentMiddleware,
  type TracePolicy,
} from "../index.js";

it("supports trace policies on middleware", () => {
  const policy: TracePolicy = {
    processInputs: omitPayload,
    processOutputs: (value) => ({ value }),
  };
  const middleware = createMiddleware({
    name: "TracePolicy",
    tracePolicy: policy,
    beforeModel: () => undefined,
  });

  expectTypeOf(middleware).toMatchTypeOf<AgentMiddleware>();
  expectTypeOf(middleware.tracePolicy).toEqualTypeOf<TracePolicy | undefined>();
});
