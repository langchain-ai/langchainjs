/* eslint-disable no-process-env */
import { afterEach, beforeAll, expect, test } from "@jest/globals";

import { registerConfigureHook, setContextVariable } from "../../context.js";
import { BaseCallbackHandler } from "../base.js";
import { CallbackManager } from "../manager.js";

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
