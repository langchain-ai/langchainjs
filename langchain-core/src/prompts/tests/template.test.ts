import { expect, test, describe } from "@jest/globals";
import { interpolateFString, interpolateHandlebars } from "../template.js";

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

describe.each([
  ["{{foo}}", { foo: "bar" }, "bar"],
  ["pre{{foo}}post", { foo: "bar" }, "prebarpost"],
  ["{{{foo}}}", { foo: "bar" }, "bar"],
  ["text", {}, "text"],
  ["}}", {}, "}}"],
  ["{{first}}_{{second}}", { first: "foo", second: "bar" }, "foo_bar"],
])("Valid handlebars", (template, variables, result) => {
  test(`Interpolation works: ${template}`, () => {
    expect(interpolateHandlebars(template, variables)).toBe(result);
  });
});

describe.each([
  ["}}{{", {}],
  ["{{", {}],
  ["{{foo", {}],
])("Invalid handlebars", (template, variables) => {
  test(`Interpolation throws: ${template}`, () => {
    expect(() => interpolateHandlebars(template, variables)).toThrow();
  });
});
