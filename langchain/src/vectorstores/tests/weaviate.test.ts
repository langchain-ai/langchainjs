import { test, expect } from "@jest/globals";

import { flattenObjectForWeaviate } from "../weaviate.js";

test("flattenObjectForWeaviate", () => {
  expect(
    flattenObjectForWeaviate({
      array2: [{}, "a"],
      deep: {
        string: "deep string",
        array: ["1", 2],
        array3: [1, 3],
        deepdeep: {
          string: "even a deeper string",
        },
      },
    })
  ).toMatchInlineSnapshot(`
    {
      "deep.array3": [
        1,
        3,
      ],
      "deep.deepdeep.string": "even a deeper string",
      "deep.string": "deep string",
    }
  `);
});
