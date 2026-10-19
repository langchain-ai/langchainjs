import { expect, test } from "vitest";

import * as pkg from "../index.js";

test("exports the documented public surface", () => {
  expect(Object.keys(pkg).sort()).toEqual(
    [
      "TypeSafeAPIError",
      "TypeSafeAuthenticationError",
      "TypeSafeClassifier",
      "TypeSafeError",
      "TypeSafeRateLimitError",
    ].sort()
  );
});
