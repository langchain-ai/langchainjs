/* eslint-disable no-process-env */
import { expect, test } from "@jest/globals";

import { registerConfigureHook, setContextVariable } from "../../context.js";
import { BaseCallbackHandler } from "../base.js";
import { CallbackManager } from "../manager.js";

class TestHandler extends BaseCallbackHandler {
  name = "TestHandler";
}

const handler = new TestHandler();

test("configure with empty array", async () => {
  const manager = CallbackManager.configure([]);
  expect(manager?.handlers.length).toBe(0);
});

test("configure with one handler", async () => {
  const manager = CallbackManager.configure([handler]);
  expect(manager?.handlers[0]).toBe(handler);
});

test("registerConfigureHook with contextVar", async () => {
  setContextVariable("foo", handler);
  registerConfigureHook({
    contextVar: "foo",
    inheritable: true,
    handlerClass: handler,
  });
  const manager = CallbackManager.configure([]);
  expect(manager?.handlers[0]).toBe(handler);
});

test("registerConfigureHook with env", async () => {
  process.env.FOO = "true";
  registerConfigureHook({
    contextVar: "foo",
    inheritable: true,
    handlerClass: handler,
    envVar: "foo",
  });
  const manager = CallbackManager.configure([]);
  expect(manager?.handlers[0]).toBe(handler);
});

test("registerConfigureHook avoids multiple", async () => {
  process.env.FOO = "true";
  registerConfigureHook({
    contextVar: "foo",
    inheritable: true,
    handlerClass: handler,
    envVar: "foo",
  });
  const manager = CallbackManager.configure([handler]);
  expect(manager?.handlers[0]).toBe(handler);
  expect(manager?.handlers[1]).toBe(undefined);
});
