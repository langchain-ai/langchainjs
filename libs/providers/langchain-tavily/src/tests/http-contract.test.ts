import { afterEach, describe, expect, test, vi } from "vitest";
import {
  TavilySearch,
  TavilyExtract,
  TavilyCrawl,
  TavilyMap,
  TavilyResearch,
  TavilyGetResearch,
} from "../index.js";
import { TavilyResearchAPIWrapper } from "../utils.js";

const fields = {
  tavilyApiKey: "tvly-fixture-private",
  apiBaseUrl: "https://fixture.invalid",
};
const operations = [
  {
    name: "search",
    invoke: () => new TavilySearch(fields).invoke({ query: "fixture" }),
  },
  {
    name: "extract",
    invoke: () =>
      new TavilyExtract(fields).invoke({ urls: ["https://example.com"] }),
  },
  {
    name: "crawl",
    invoke: () =>
      new TavilyCrawl(fields).invoke({ url: "https://example.com" }),
  },
  {
    name: "map",
    invoke: () => new TavilyMap(fields).invoke({ url: "https://example.com" }),
  },
  {
    name: "research",
    invoke: () => new TavilyResearch(fields).invoke({ input: "fixture" }),
  },
  {
    name: "research status",
    invoke: () =>
      new TavilyGetResearch(fields).invoke({ requestId: "fixture" }),
  },
];
const errors = [
  {
    label: "string detail",
    body: JSON.stringify({ detail: "Invalid query" }),
    expected: "Invalid query",
  },
  {
    label: "object detail",
    body: JSON.stringify({ detail: { error: "Rate limited" } }),
    expected: "Rate limited",
  },
  {
    label: "validation list",
    body: JSON.stringify({
      detail: [{ loc: ["body", "query"], msg: "Field required" }],
    }),
    expected: "Field required",
  },
  {
    label: "plain text",
    body: "Upstream unavailable",
    expected: "Upstream unavailable",
  },
  {
    label: "null detail",
    body: JSON.stringify({ detail: null, message: "Invalid request" }),
    expected: "Invalid request",
  },
  {
    label: "empty detail",
    body: JSON.stringify({ detail: "", error: "Invalid request" }),
    expected: "Invalid request",
  },
  { label: "empty body", body: "", expected: "Bad Request" },
];
afterEach(() => vi.unstubAllGlobals());

describe.each(operations)("$name HTTP contract", ({ invoke }) => {
  test.each(errors)(
    "retains $label without changing the returned-error contract",
    async ({ body, expected }) => {
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValue(
            new Response(body, { status: 400, statusText: "Bad Request" })
          )
      );
      const result = await invoke();
      expect(result).toEqual({ error: expect.stringContaining("Error 400:") });
      expect(result).toEqual({ error: expect.stringContaining(expected) });
    }
  );
  test("uses the same identity on POST and status GET", async () => {
    const request = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ detail: "fixture" }), { status: 401 })
      );
    vi.stubGlobal("fetch", request);
    await invoke();
    const init = request.mock.calls[0][1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(headers.get("Authorization")).toBe("Bearer tvly-fixture-private");
    expect(headers.get("X-Client-Name")).toBe("langchain-js");
    expect(headers.get("X-Client-Source")).toBe("api");
    if (init.body)
      expect(JSON.parse(String(init.body))).not.toHaveProperty(
        "client_source",
        "langchain-js"
      );
  });
  test("bounds details and redacts the API key", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(`Bearer tvly-fixture-private ${"x".repeat(5000)}`, {
          status: 500,
        })
      )
    );
    const result = await invoke();
    expect(result).toHaveProperty("error");
    const error = (result as { error: string }).error;
    expect(error).not.toContain(fields.tavilyApiKey);
    expect(error).toContain("[REDACTED]");
    expect(error.length).toBeLessThanOrEqual(2100);
    expect(error).toContain("Error 500:");
  });
});

test("existing Research streaming preserves HTTP error details before returning an iterator", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response("invalid stream request", { status: 400 })
      )
  );
  await expect(
    new TavilyResearchAPIWrapper(fields).rawResults({
      input: "fixture",
      stream: true,
    })
  ).rejects.toThrow("Error 400: invalid stream request");
});

test("existing Research stream still yields the original bytes", async () => {
  const bytes = new TextEncoder().encode("event: done\n\n");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(bytes)));
  const stream = await new TavilyResearchAPIWrapper(fields).rawResults({
    input: "fixture",
    stream: true,
  });
  expect(Symbol.asyncIterator in stream).toBe(true);
  const chunks: Buffer[] = [];
  for await (const chunk of stream as AsyncGenerator<Buffer>)
    chunks.push(chunk);
  expect(Buffer.concat(chunks)).toEqual(Buffer.from(bytes));
});

test.each([401, 429, 500])(
  "preserves HTTP %i across all six public tools",
  async (status) => {
    for (const { invoke } of operations) {
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValue(
            new Response(JSON.stringify({ detail: "fixture failure" }), {
              status,
            })
          )
      );
      expect(await invoke()).toEqual({
        error: `Error ${status}: fixture failure`,
      });
    }
  }
);

test("transport failures keep the returned-error convention", async () => {
  for (const { invoke } of operations) {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("fixture disconnect"))
    );
    expect(await invoke()).toEqual({ error: "fixture disconnect" });
  }
});

test("ToolCall error remains a returned error message rather than throwing", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ detail: "fixture authentication" }), {
          status: 401,
        })
      )
  );
  const result = await new TavilySearch(fields).invoke({
    type: "tool_call",
    id: "fixture",
    name: "tavily_search",
    args: { query: "fixture" },
  });
  expect(result).toHaveProperty("tool_call_id", "fixture");
  expect(JSON.parse(result.content as string)).toEqual({
    error: "Error 401: fixture authentication",
  });
});
