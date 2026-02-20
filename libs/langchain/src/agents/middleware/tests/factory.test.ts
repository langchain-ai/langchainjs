import { describe, it, expect } from "vitest";

import type { AgentMiddleware } from "../types.js";
import {
  AgentMiddlewareBuilder,
  BuiltInAgentMiddleware,
  createBuiltInAgentMiddleware,
} from "../factory.js";

describe("createBuiltInAgentMiddleware", () => {
  it("creates todo list middleware without explicit config", () => {
    const middleware = createBuiltInAgentMiddleware(
      BuiltInAgentMiddleware.TodoList,
      undefined
    );
    expect(middleware.name).toBe("todoListMiddleware");
  });

  it("creates model retry middleware with provided config", () => {
    const middleware = createBuiltInAgentMiddleware(
      BuiltInAgentMiddleware.ModelRetry,
      {}
    );
    expect(middleware.name).toBe("modelRetryMiddleware");
  });
});

describe("AgentMiddlewareBuilder", () => {
  it("adds built-in middleware conditionally", () => {
    const builder = new AgentMiddlewareBuilder();
    const middleware = builder
      .addBuiltIn({
        name: BuiltInAgentMiddleware.TodoList,
      })
      .addBuiltIn({
        name: BuiltInAgentMiddleware.TodoList,
        when: false,
      })
      .build();

    expect(middleware).toHaveLength(1);
    expect(middleware[0]?.name).toBe("todoListMiddleware");
  });

  it("supports mixing pre-built middleware with built-ins", () => {
    const customMiddleware = { name: "custom" } as AgentMiddleware;
    const builder = new AgentMiddlewareBuilder();

    const middleware = builder
      .add(customMiddleware)
      .addBuiltIn({
        name: BuiltInAgentMiddleware.ModelRetry,
        config: {},
      })
      .build();

    expect(middleware).toHaveLength(2);
    expect(middleware[0]?.name).toBe("custom");
    expect(middleware[1]?.name).toBe("modelRetryMiddleware");
  });
});
