import { test, expect } from "@jest/globals";
import { difference, intersection, union } from "../set.js";

test("difference", () => {
  const set1 = new Set(["a", "b"]);
  const set2 = new Set(["b", "c"]);

  const resultSet = difference(set1, set2);
  expect(resultSet).toMatchInlineSnapshot(`
      Set {
        "a",
      }
    `);
});

test("intersection", () => {
  const set1 = new Set(["a", "b", "c", "d"]);
  const set2 = new Set(["b", "c", "e"]);

  const resultSet = intersection(set1, set2);
  expect(resultSet).toMatchInlineSnapshot(`
      Set {
        "b",
        "c",
      }
    `);
});

test("union", () => {
  const set1 = new Set(["a", "b"]);
  const set2 = new Set(["c", "d"]);

  const resultSet = union(set1, set2);
  expect(resultSet).toMatchInlineSnapshot(`
      Set {
        "a",
        "b",
        "c",
        "d",
      }
    `);
});
