import { test, expect } from "@jest/globals";
import { JsonListKeysTool, JsonSpec, JsonGetValueTool } from "../tools/json.js";

test("JsonListKeysTool", async () => {
  const jsonSpec = new JsonSpec({
    foo: "bar",
    baz: { test: { foo: [1, 2, 3], qux: [{ x: 1, y: 2, z: 3 }, { a: 1 }] } },
  });
  const jsonListKeysTool = new JsonListKeysTool(jsonSpec);
  expect(await jsonListKeysTool.call("")).toBe("foo, baz");
  expect(await jsonListKeysTool.call("/foo")).toContain("not a dictionary");
  expect(await jsonListKeysTool.call("/baz")).toBe("test");
  expect(await jsonListKeysTool.call("/baz/test")).toBe("foo, qux");
  expect(await jsonListKeysTool.call("/baz/test/foo")).toContain(
    "not a dictionary"
  );
  expect(await jsonListKeysTool.call("/baz/test/foo/0")).toContain(
    "not a dictionary"
  );
  expect(await jsonListKeysTool.call("/baz/test/qux")).toContain(
    "not a dictionary"
  );
  expect(await jsonListKeysTool.call("/baz/test/qux/0")).toBe("x, y, z");
  expect(await jsonListKeysTool.call("/baz/test/qux/1")).toBe("a");
  expect(await jsonListKeysTool.call("/bar")).toContain("not a dictionary");
});

test("JsonGetValueTool", async () => {
  const jsonSpec = new JsonSpec({
    foo: "bar",
    baz: { test: { foo: [1, 2, 3], qux: [{ x: 1, y: 2, z: 3 }, { a: 1 }] } },
  });
  const jsonGetValueTool = new JsonGetValueTool(jsonSpec);
  expect(await jsonGetValueTool.call("")).toBe(
    `{"foo":"bar","baz":{"test":{"foo":[1,2,3],"qux":[{"x":1,"y":2,"z":3},{"a":1}]}}}`
  );
  expect(await jsonGetValueTool.call("/foo")).toBe("bar");
  expect(await jsonGetValueTool.call("/baz")).toBe(
    `{"test":{"foo":[1,2,3],"qux":[{"x":1,"y":2,"z":3},{"a":1}]}}`
  );
  expect(await jsonGetValueTool.call("/baz/test")).toBe(
    `{"foo":[1,2,3],"qux":[{"x":1,"y":2,"z":3},{"a":1}]}`
  );
  expect(await jsonGetValueTool.call("/baz/test/foo")).toBe("[1,2,3]");
  expect(await jsonGetValueTool.call("/baz/test/foo/0")).toBe("1");
  expect(await jsonGetValueTool.call("/baz/test/qux")).toBe(
    `[{"x":1,"y":2,"z":3},{"a":1}]`
  );
  expect(await jsonGetValueTool.call("/baz/test/qux/0")).toBe(
    `{"x":1,"y":2,"z":3}`
  );
  expect(await jsonGetValueTool.call("/baz/test/qux/0/x")).toBe("1");
  expect(await jsonGetValueTool.call("/baz/test/qux/1")).toBe(`{"a":1}`);
  expect(await jsonGetValueTool.call("/bar")).toContain(`null`);
});

test("JsonGetValueTool, large values", async () => {
  const jsonSpec = new JsonSpec(
    { foo: "bar", baz: { test: { foo: [1, 2, 3, 4] } } },
    5
  );
  const jsonGetValueTool = new JsonGetValueTool(jsonSpec);
  expect(await jsonGetValueTool.call("")).toContain("large dictionary");
  expect(await jsonGetValueTool.call("/foo")).toBe("bar");
  expect(await jsonGetValueTool.call("/baz")).toContain("large dictionary");
  expect(await jsonGetValueTool.call("/baz/test")).toContain(
    "large dictionary"
  );
  expect(await jsonGetValueTool.call("/baz/test/foo")).toBe("[1,2,...");
  expect(await jsonGetValueTool.call("/baz/test/foo/0")).toBe("1");
});
