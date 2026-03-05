import { afterEach, beforeAll, expect, test, vi } from "vitest";

import { registerConfigureHook, setContextVariable } from "../../context.js";
import { LangChainTracer } from "../../tracers/tracer_langchain.js";
import { BaseCallbackHandler } from "../base.js";
import { CallbackManager } from "../manager.js";
import { RunTree } from "langsmith/run_trees";

class TestHandler extends BaseCallbackHandler {
  name = "TestHandler";
}

const handlerInstance = new TestHandler();

beforeAll(() => {
  process.env.LANGCHAIN_TRACING_V2 = "false";
  process.env.LANGSMITH_TRACING_V2 = "false";
  process.env.__TEST_VAR = "false";
});

afterEach(() => {
  setContextVariable("my_test_handler", undefined);
  vi.restoreAllMocks();
});

test("configure with empty array", async () => {
  const manager = CallbackManager.configure([]);
  expect(manager?.handlers.length).toBe(0);
});

test("configure with no arguments", async () => {
  const manager = CallbackManager.configure();
  expect(manager).toBe(undefined);
});

test("configure with no arguments but with handler", async () => {
  setContextVariable("my_test_handler", handlerInstance);
  registerConfigureHook({
    contextVar: "my_test_handler",
  });
  const manager = CallbackManager.configure();
  expect(manager?.handlers[0]).toBe(handlerInstance);
});

test("configure with one handler", async () => {
  const manager = CallbackManager.configure([handlerInstance]);
  expect(manager?.handlers[0]).toBe(handlerInstance);
});

test("registerConfigureHook with contextVar", async () => {
  setContextVariable("my_test_handler", handlerInstance);
  registerConfigureHook({
    contextVar: "my_test_handler",
  });
  const manager = CallbackManager.configure([]);
  expect(manager?.handlers[0]).toBe(handlerInstance);
});

test("registerConfigureHook with env", async () => {
  process.env.__TEST_VAR = "true";
  registerConfigureHook({
    handlerClass: TestHandler,
    envVar: "__TEST_VAR",
  });
  const manager = CallbackManager.configure([]);
  expect(manager?.handlers[0].name).toBe("TestHandler");
});

test("registerConfigureHook doesn't add with env false", async () => {
  process.env.__TEST_VAR = "false";
  registerConfigureHook({
    handlerClass: TestHandler,
    envVar: "__TEST_VAR",
  });
  const manager = CallbackManager.configure([]);
  expect(manager?.handlers.length).toBe(0);
});

test("registerConfigureHook avoids multiple", async () => {
  process.env.__TEST_VAR = "true";
  registerConfigureHook({
    contextVar: "my_test_handler",
    handlerClass: TestHandler,
    envVar: "__TEST_VAR",
  });
  const manager = CallbackManager.configure([handlerInstance]);
  expect(manager?.handlers[0]).toBe(handlerInstance);
  expect(manager?.handlers[1]).toBe(undefined);
});

test("configure respects tracingEnabled=false from RunTree even when env tracing is enabled", async () => {
  // Enable tracing via environment variable
  vi.stubEnv("LANGCHAIN_TRACING_V2", "true");

  // Mock getTraceableRunTree to return a RunTree with tracingEnabled=false
  vi.spyOn(LangChainTracer, "getTraceableRunTree").mockReturnValue(
    new RunTree({
      name: "test-run",
      tracingEnabled: false,
      id: "test-run-id",
    })
  );

  const manager = CallbackManager.configure([]);

  // The tracer should NOT be added because the RunTree explicitly disabled tracing
  const hasTracer = manager?.handlers.some(
    (handler) => handler.name === "langchain_tracer"
  );
  expect(hasTracer).toBe(false);

  vi.unstubAllEnvs();
});

test("configure removes inherited LangChainTracer when tracingEnabled=false from RunTree", async () => {
  // Enable tracing via environment variable
  vi.stubEnv("LANGCHAIN_TRACING_V2", "true");

  // Mock getTraceableRunTree to return a RunTree with tracingEnabled=false
  vi.spyOn(LangChainTracer, "getTraceableRunTree").mockReturnValue(
    new RunTree({
      name: "test-run",
      tracingEnabled: false,
      id: "test-run-id",
    })
  );

  // Create a callback manager with an inherited LangChainTracer
  // (simulates a child run inheriting a tracer from a traced parent)
  const parentManager = new CallbackManager();
  const inheritedTracer = new LangChainTracer();
  parentManager.addHandler(inheritedTracer, true);

  const manager = CallbackManager.configure(parentManager);

  // The inherited tracer should be REMOVED because the RunTree
  // explicitly disabled tracing
  const hasTracer = manager?.handlers.some(
    (handler) => handler.name === "langchain_tracer"
  );
  expect(hasTracer).toBe(false);

  vi.unstubAllEnvs();
});

test("configure keeps inherited LangChainTracer when tracingEnabled=true from RunTree", async () => {
  // Enable tracing via environment variable
  vi.stubEnv("LANGCHAIN_TRACING_V2", "true");

  // Mock getTraceableRunTree to return a RunTree with tracingEnabled=true
  vi.spyOn(LangChainTracer, "getTraceableRunTree").mockReturnValue(
    new RunTree({
      name: "test-run",
      tracingEnabled: true,
      id: "test-run-id",
    })
  );

  // Create a callback manager with an inherited LangChainTracer
  const parentManager = new CallbackManager();
  const inheritedTracer = new LangChainTracer();
  parentManager.addHandler(inheritedTracer, true);

  const manager = CallbackManager.configure(parentManager);

  // The inherited tracer should be KEPT because tracing is enabled
  const hasTracer = manager?.handlers.some(
    (handler) => handler.name === "langchain_tracer"
  );
  expect(hasTracer).toBe(true);

  vi.unstubAllEnvs();
});

test("configure removes inherited LangChainTracer but keeps other handlers when tracingEnabled=false", async () => {
  // Enable tracing via environment variable
  vi.stubEnv("LANGCHAIN_TRACING_V2", "true");

  // Mock getTraceableRunTree to return a RunTree with tracingEnabled=false
  vi.spyOn(LangChainTracer, "getTraceableRunTree").mockReturnValue(
    new RunTree({
      name: "test-run",
      tracingEnabled: false,
      id: "test-run-id",
    })
  );

  // Create a callback manager with both a LangChainTracer and a custom handler
  const parentManager = new CallbackManager();
  const inheritedTracer = new LangChainTracer();
  parentManager.addHandler(inheritedTracer, true);
  parentManager.addHandler(handlerInstance, true);

  const manager = CallbackManager.configure(parentManager);

  // The LangChainTracer should be removed but the custom handler should remain
  const hasTracer = manager?.handlers.some(
    (handler) => handler.name === "langchain_tracer"
  );
  expect(hasTracer).toBe(false);

  const hasCustomHandler = manager?.handlers.some(
    (handler) => handler.name === "TestHandler"
  );
  expect(hasCustomHandler).toBe(true);

  vi.unstubAllEnvs();
});
