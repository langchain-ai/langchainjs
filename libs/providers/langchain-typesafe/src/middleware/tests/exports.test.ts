import { expect, test } from "vitest";

import * as pkg from "../index.js";

test("exports the documented public surface", () => {
  expect(Object.keys(pkg).sort()).toEqual(
    ["autoModeMiddleware", "modelRouterMiddleware"].sort()
  );
  expect(typeof pkg.autoModeMiddleware).toBe("function");
  expect(typeof pkg.modelRouterMiddleware).toBe("function");
});
