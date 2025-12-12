import { test, expect } from "vitest";
import { getRuntimeEnvironment } from "../env.js";

test("test getRuntimeEnvironment", async () => {
  const runtimeEnvironment = await getRuntimeEnvironment();
  expect(runtimeEnvironment.runtime).toEqual("node");
});
