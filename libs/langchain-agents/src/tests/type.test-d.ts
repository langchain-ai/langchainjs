import { test, expectTypeOf } from "vitest";
import { FakeToolCallingModel } from "./utils";
import { createReactAgent, InternalReactAgent, ReactAgent } from "../index";

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
