import { test, expect } from "@jest/globals";
import {JsonListKeysTool, JsonSpec, JsonGetValueTool} from "../tools/json";

test("JsonListKeysTool", async () => {
    const jsonSpec = new JsonSpec(
        {"foo": "bar", "baz": {"test": {"foo": [1, 2, 3]}}}
    );
    const jsonListKeysTool = new JsonListKeysTool(jsonSpec);
    expect(await jsonListKeysTool.call("data")).toBe("foo, baz");
    expect(await jsonListKeysTool.call('data["foo"]')).toContain("not a dictionary");
    expect(await jsonListKeysTool.call('data["baz"]')).toBe("test");
    expect(await jsonListKeysTool.call('data["baz"]["test"]')).toBe("foo");
    expect(await jsonListKeysTool.call('data["baz"]["test"]["foo"]')).toContain("not a dictionary");
    expect(await jsonListKeysTool.call('data["baz"]["test"]["foo"][0]')).toContain("not a dictionary");
});

test("JsonGetValueTool", async () => {
    const jsonSpec = new JsonSpec(
        {"foo": "bar", "baz": {"test": {"foo": [1, 2, 3]}}}
    );
    const jsonGetValueTool = new JsonGetValueTool(jsonSpec);
    expect(await jsonGetValueTool.call("data")).toBe(`{"foo":"bar","baz":{"test":{"foo":[1,2,3]}}}`);
    expect(await jsonGetValueTool.call('data["foo"]')).toBe("bar");
    expect(await jsonGetValueTool.call('data["baz"]')).toBe(`{"test":{"foo":[1,2,3]}}`);
    expect(await jsonGetValueTool.call('data["baz"]["test"]')).toBe(`{"foo":[1,2,3]}`);
    expect(await jsonGetValueTool.call('data["baz"]["test"]["foo"]')).toBe("1,2,3");
    expect(await jsonGetValueTool.call('data["baz"]["test"]["foo"][0]')).toBe("1");
});

test("JsonGetValueTool, large values", async () => {
    const jsonSpec = new JsonSpec(
        {"foo": "bar", "baz": {"test": {"foo": [1, 2, 3, 4]}}}, 5
    );
    const jsonGetValueTool = new JsonGetValueTool(jsonSpec);
    expect(await jsonGetValueTool.call("data")).toContain("large dictionary");
    expect(await jsonGetValueTool.call('data["foo"]')).toBe("bar");
    expect(await jsonGetValueTool.call('data["baz"]')).toContain("large dictionary");
    expect(await jsonGetValueTool.call('data["baz"]["test"]')).toContain("large dictionary");
    expect(await jsonGetValueTool.call('data["baz"]["test"]["foo"]')).toBe("1,2,3...");
    expect(await jsonGetValueTool.call('data["baz"]["test"]["foo"][0]')).toBe("1");
});
