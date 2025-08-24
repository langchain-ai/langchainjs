import { test, expect } from "vitest";
import { getRuntimeEnvironmentSync } from "../env.js";

test("test getRuntimeEnvironmentSync", async () => {
  const runtimeEnvironment = getRuntimeEnvironmentSync();
  console.log(runtimeEnvironment);
  expect(runtimeEnvironment.runtime).toEqual("node");
});
