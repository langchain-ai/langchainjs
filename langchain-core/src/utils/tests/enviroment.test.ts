import { getRuntimeEnvironment } from "../env.js";
import { test, expect } from "@jest/globals";

test("test getRuntimeEnvironment", async () => {
  const runtimeEnvironment = await getRuntimeEnvironment();
  console.log(runtimeEnvironment);
  expect(runtimeEnvironment.runtime).toEqual("node");
});
