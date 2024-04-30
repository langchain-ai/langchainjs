import { test } from "@jest/globals";
import { updateEntrypointsFrom0_x_xTo0_2_x } from "../migrations/0_2.js";

test("updateEntrypointsFrom0_x_xTo0_2_x", () => {
  const pathToExamples = "../../examples";

  updateEntrypointsFrom0_x_xTo0_2_x({
    projectPath: pathToExamples,
    shouldLog: true,
  });
});