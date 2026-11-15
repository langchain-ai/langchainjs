import { expectTypeOf, it } from "vitest";
import {
  omitPayload,
  type TracePolicy,
} from "@langchain/core/tracers/tracer_langchain";

import { createMiddleware, type AgentMiddleware } from "../index.js";

it("supports trace policies on middleware", () => {
  const middleware = createMiddleware({
    name: "TracePolicy",
    tracePolicy: {
      processInputs: omitPayload,
      processOutputs: (outputs) => ({ keys: Object.keys(outputs) }),
    },
    beforeModel: () => undefined,
  });

  expectTypeOf(middleware).toMatchTypeOf<AgentMiddleware>();
  expectTypeOf(middleware.tracePolicy).toEqualTypeOf<TracePolicy | undefined>();
});
