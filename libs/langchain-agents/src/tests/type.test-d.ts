import { test, expectTypeOf } from "vitest";
import { FakeToolCallingModel } from "./utils.js";
import { createReactAgent, InternalReactAgent, ReactAgent } from "../index.js";

test("createReactAgent simple type", () => {
  const agent = createReactAgent({
    llm: new FakeToolCallingModel(),
    tools: [],
  });

  expectTypeOf(agent).toEqualTypeOf<ReactAgent>();
});

test("createReactAgent with asStateGraph", () => {
  const agent = createReactAgent({
    llm: new FakeToolCallingModel(),
    tools: [],
    asStateGraph: true,
  });

  expectTypeOf(agent).toEqualTypeOf<InternalReactAgent>();
});
