import { test, expect } from "@jest/globals";
import { flattenObjectForWeaviate } from "../vectorstores.js";

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
      emptyArray: [],
    })
  ).toMatchInlineSnapshot(`
    {
      "deep_array3": [
        1,
        3,
      ],
      "deep_deepdeep_string": "even a deeper string",
      "deep_string": "deep string",
      "emptyArray": [],
    }
  `);
});
