import { test, expect } from "@jest/globals";
import { flattenObjectForWeaviate } from "../vectorstores.js";

test("flattenObjectForWeaviate", () => {
  expect(
    flattenObjectForWeaviate({
      array2: [{}, "a"],
      "some:colon": "key only should:be:replaced with some_colon",
      "some;crazy;keys": "test",
      "more*crazy*keys": "test",
      deep: {
        string: "deep string",
        array: ["1", 2],
        array3: [1, 3],
        "duda:colon:test": "test",
        "caret^test": "test",
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
      "deep_caret_test": "test",
      "deep_deepdeep_string": "even a deeper string",
      "deep_duda_colon_test": "test",
      "deep_string": "deep string",
      "emptyArray": [],
      "more_crazy_keys": "test",
      "some_colon": "key only should:be:replaced with some_colon",
      "some_crazy_keys": "test",
    }
  `);
});
