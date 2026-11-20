import { describe, expect, test, vi } from "vitest";
import { RequestsGetTool, RequestsPostTool } from "../requests.js";

describe("RequestsGetTool", () => {
  test("uses the fetch it is given", async () => {
    const fetch = vi.fn(async () => new Response("hello world"));
    const tool = new RequestsGetTool(
      { "x-test": "1" },
      { fetch, maxOutputLength: 5 }
    );
    expect(await tool.invoke("https://example.com/")).toBe("hello");
    expect(fetch).toHaveBeenCalledWith("https://example.com/", {
      headers: { "x-test": "1" },
    });
  });

  test("refuses private network addresses by default", async () => {
    const tool = new RequestsGetTool();
    await expect(tool.invoke("http://127.0.0.1:8080/")).rejects.toThrow(
      /localhost/
    );
    await expect(
      tool.invoke("http://169.254.169.254/latest/meta-data/")
    ).rejects.toThrow(/metadata/);
  });
});

describe("RequestsPostTool", () => {
  test("uses the fetch it is given", async () => {
    const fetch = vi.fn(async () => new Response("ok"));
    const tool = new RequestsPostTool({}, { fetch });
    const input = JSON.stringify({
      url: "https://example.com/",
      data: { a: 1 },
    });
    expect(await tool.invoke(input)).toBe("ok");
    expect(fetch).toHaveBeenCalledWith("https://example.com/", {
      method: "POST",
      headers: {},
      body: '{"a":1}',
    });
  });

  test("refuses private network addresses by default", async () => {
    const tool = new RequestsPostTool();
    const input = JSON.stringify({ url: "http://10.0.0.1/", data: {} });
    expect(await tool.invoke(input)).toMatch(/private IP/);
  });
});
