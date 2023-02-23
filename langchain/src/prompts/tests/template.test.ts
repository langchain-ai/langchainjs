import { expect, test, describe } from "@jest/globals";
import { interpolateFString } from "../template.js";

describe.each([
  ["{foo}", { foo: "bar" }, "bar"],
  ["pre{foo}post", { foo: "bar" }, "prebarpost"],
  ["{{pre{foo}post}}", { foo: "bar" }, "{prebarpost}"],
  ["text", {}, "text"],
  ["}}{{", {}, "}{"],
  ["{first}_{second}", { first: "foo", second: "bar" }, "foo_bar"],
])("Valid f-string", (template, variables, result) => {
  test(`Interpolation works: ${template}`, () => {
    expect(interpolateFString(template, variables)).toBe(result);
  });
});

describe.each([
  ["{", {}],
  ["}", {}],
  ["{foo", {}],
  ["foo}", {}],
])("Invalid f-string", (template, variables) => {
  test(`Interpolation throws: ${template}`, () => {
    expect(() => interpolateFString(template, variables)).toThrow();
  });
});
