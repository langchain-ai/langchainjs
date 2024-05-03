import { test } from "@jest/globals";
import { updateEntrypointsFrom0_x_xTo0_2_x } from "../migrations/0_2.js";

test("updateEntrypointsFrom0_x_xTo0_2_x", async () => {
  const pathToExamples =
    "/Users/bracesproul/code/lang-chain-ai/wt/jacob/0.2/examples";

  await updateEntrypointsFrom0_x_xTo0_2_x({
    projectPath: pathToExamples,
    shouldLog: false,
  });
});
