import { afterEach, describe, expect, test, vi } from "vitest";
import * as runtime from "../ssrf/runtime.js";
import { createSafeFetch, validateSafeUrlAsync } from "../ssrf.js";

vi.mock("../ssrf/runtime.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../ssrf/runtime.js")>()),
  isNodeRuntime: vi.fn(() => false),
  getBun: vi.fn(() => undefined),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(runtime.getBun).mockReturnValue(undefined);
});

function stubFetch(responses: Response[]) {
  const fetchMock = vi.fn(async () => responses.shift() as Response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("createSafeFetch without DNS", () => {
  test("follows redirects by hand and checks every hop", async () => {
    const fetchMock = stubFetch([
      new Response(null, {
        status: 302,
        headers: { location: "https://other.example.com/next" },
      }),
      new Response(null, {
        status: 302,
        headers: { location: "http://127.0.0.1/admin" },
      }),
    ]);
    await expect(
      createSafeFetch()("https://example.com/start", {
        headers: { authorization: "Bearer secret" },
      })
    ).rejects.toThrow(/localhost/);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const calls = fetchMock.mock.calls as unknown as [URL, RequestInit][];
    expect(calls[0][1].redirect).toBe("manual");
    expect(String(calls[1][0])).toBe("https://other.example.com/next");
    expect(new Headers(calls[1][1].headers).has("authorization")).toBe(false);
  });

  test("returns the final response", async () => {
    stubFetch([new Response("ok", { status: 200 })]);
    const res = await createSafeFetch()("https://example.com/");
    expect(await res.text()).toBe("ok");
    expect(res.url).toBe("https://example.com/");
  });

  test("fails on a redirect the runtime hides", async () => {
    const opaque = new Response(null, { status: 200 });
    Object.defineProperty(opaque, "type", { value: "opaqueredirect" });
    stubFetch([opaque]);
    await expect(createSafeFetch()("https://example.com/")).rejects.toThrow(
      /redirect/
    );
  });

  test("validateSafeUrlAsync falls back to the static checks", async () => {
    await expect(validateSafeUrlAsync("https://example.com")).resolves.toBe(
      "https://example.com"
    );
    await expect(validateSafeUrlAsync("https://[::1]")).rejects.toThrow(
      /localhost/
    );
  });
});

describe("createSafeFetch on Bun", () => {
  test("connects to the checked address with the original Host and server name", async () => {
    const lookup = vi.fn(async () => [
      { address: "93.184.216.34", family: 4 as const },
    ]);
    vi.mocked(runtime.getBun).mockReturnValue({ dns: { lookup } });
    const fetchMock = stubFetch([new Response("ok")]);

    const res = await createSafeFetch()("https://example.com/path?q=1");
    expect(await res.text()).toBe("ok");
    expect(res.url).toBe("https://example.com/path?q=1");

    const [target, init] = fetchMock.mock.calls[0] as unknown as [
      URL,
      RequestInit & { tls?: { serverName: string } },
    ];
    expect(String(target)).toBe("https://93.184.216.34/path?q=1");
    expect(new Headers(init.headers).get("host")).toBe("example.com");
    expect(init.tls).toEqual({ serverName: "example.com" });
    expect(init.redirect).toBe("manual");
  });

  test("refuses a hostname that resolves to a private address", async () => {
    vi.mocked(runtime.getBun).mockReturnValue({
      dns: { lookup: async () => [{ address: "10.1.2.3", family: 4 }] },
    });
    const fetchMock = stubFetch([]);
    await expect(createSafeFetch()("https://example.com/")).rejects.toThrow(
      /private IP/
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
