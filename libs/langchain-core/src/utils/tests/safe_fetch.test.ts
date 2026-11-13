import * as dns from "node:dns";
import * as http from "node:http";
import type { AddressInfo } from "node:net";
import { gzipSync } from "node:zlib";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
  vi,
} from "vitest";
import { createSafeFetch, validateSafeUrlAsync } from "../ssrf.js";

let server: http.Server;
let port: number;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://placeholder");
    const to = url.searchParams.get("to");
    if (url.pathname === "/redirect" && to) {
      res.writeHead(Number(url.searchParams.get("status") ?? 302), {
        location: to,
      });
      res.end("redirecting");
      return;
    }
    if (url.pathname === "/loop") {
      res.writeHead(302, { location: "/loop" });
      res.end();
      return;
    }
    if (url.pathname === "/slow") return;
    if (url.pathname === "/odd-status") {
      res.writeHead(999);
      res.end();
      return;
    }
    if (url.pathname === "/empty") {
      res.writeHead(204);
      res.end();
      return;
    }
    if (url.pathname === "/gzip") {
      res.writeHead(200, { "content-encoding": "gzip" });
      res.end(gzipSync("compressed hello"));
      return;
    }
    if (url.pathname === "/cookies") {
      res.setHeader("set-cookie", ["a=1", "b=2"]);
      res.end("ok");
      return;
    }
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      res.setHeader("content-type", "application/json");
      res.end(
        JSON.stringify({
          method: req.method,
          headers: req.headers,
          body: Buffer.concat(chunks).toString(),
        })
      );
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as AddressInfo).port;
});

afterAll(() => {
  server.closeAllConnections();
  server.close();
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Point every hostname at the given addresses. */
function mockDns(v4: string[], v6: string[] = []) {
  vi.spyOn(dns.promises, "lookup").mockImplementation((async () => [
    ...v4.map((address) => ({ address, family: 4 })),
    ...v6.map((address) => ({ address, family: 6 })),
  ]) as never);
}

// Resolves test hostnames to the local server, which only a policy that
// allows loopback addresses may reach.
const loopbackFetch = (options: Parameters<typeof createSafeFetch>[0] = {}) => {
  mockDns(["127.0.0.1"]);
  return createSafeFetch({
    ...options,
    policy: { blockLocalhost: false, ...options.policy },
  });
};

describe("createSafeFetch on Node", () => {
  test("blocks localhost names, loopback literals and mapped IPv6", async () => {
    const safeFetch = createSafeFetch();
    await expect(safeFetch(`http://localhost:${port}/`)).rejects.toThrow(
      /localhost/
    );
    await expect(safeFetch(`http://127.0.0.1:${port}/`)).rejects.toThrow(
      /localhost/
    );
    await expect(
      safeFetch(`http://[::ffff:127.0.0.1]:${port}/`)
    ).rejects.toThrow(/localhost/);
  });

  test("blocks a hostname that resolves to a private address", async () => {
    mockDns(["10.0.0.5"]);
    await expect(
      createSafeFetch()(`http://internal.example.com:${port}/`)
    ).rejects.toThrow(/resolves to private IP: 10\.0\.0\.5/);
  });

  test("blocks a hostname when any of its addresses is private", async () => {
    mockDns(["93.184.216.34"], ["fd00::1"]);
    await expect(
      createSafeFetch()(`http://mixed.example.com:${port}/`)
    ).rejects.toThrow(/private IP: fd00::1/);
  });

  test("connects to the address it checked", async () => {
    const res = await loopbackFetch()(`http://public.example.com:${port}/`);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.headers.host).toBe(`public.example.com:${port}`);
    expect(res.url).toBe(`http://public.example.com:${port}/`);
  });

  test("allowedHosts skip the address checks, but not on redirects", async () => {
    const safeFetch = createSafeFetch({ allowedHosts: ["localhost"] });
    const res = await safeFetch(`http://localhost:${port}/echo`);
    expect(res.status).toBe(200);
    await res.body?.cancel();

    const to = encodeURIComponent(`http://127.0.0.1:${port}/echo`);
    await expect(
      safeFetch(`http://localhost:${port}/redirect?to=${to}`)
    ).rejects.toThrow(/localhost: 127\.0\.0\.1/);
  });

  test("cross-origin redirects drop credentials, even back on the origin", async () => {
    const back = encodeURIComponent(`http://first.example.com:${port}/echo`);
    const away = encodeURIComponent(
      `http://second.example.com:${port}/redirect?to=${back}`
    );
    const res = await loopbackFetch()(
      `http://first.example.com:${port}/redirect?to=${away}`,
      {
        headers: {
          authorization: "Bearer secret",
          cookie: "session=1",
          accept: "application/json",
          "user-agent": "test-agent",
        },
      }
    );
    const { headers } = await res.json();
    expect(headers.authorization).toBeUndefined();
    expect(headers.cookie).toBeUndefined();
    expect(headers.accept).toBe("application/json");
    expect(headers["user-agent"]).toBe("test-agent");
  });

  test("same-origin redirects keep headers", async () => {
    const res = await loopbackFetch()(
      `http://first.example.com:${port}/redirect?to=/echo`,
      { headers: { authorization: "Bearer secret" } }
    );
    expect((await res.json()).headers.authorization).toBe("Bearer secret");
  });

  test("303 switches to GET and drops the body", async () => {
    const res = await loopbackFetch()(
      `http://a.example.com:${port}/redirect?status=303&to=/echo`,
      {
        method: "POST",
        body: "data",
        headers: { "content-type": "text/plain" },
      }
    );
    const body = await res.json();
    expect(body.method).toBe("GET");
    expect(body.body).toBe("");
    expect(body.headers["content-type"]).toBeUndefined();
  });

  test("307 keeps the method and body", async () => {
    const res = await loopbackFetch()(
      `http://a.example.com:${port}/redirect?status=307&to=/echo`,
      { method: "POST", body: "data" }
    );
    const body = await res.json();
    expect(body.method).toBe("POST");
    expect(body.body).toBe("data");
  });

  test("enforces maxRedirects", async () => {
    await expect(
      loopbackFetch({ maxRedirects: 2 })(`http://a.example.com:${port}/loop`)
    ).rejects.toThrow(/Too many redirects/);
  });

  test("redirect: manual returns the redirect", async () => {
    const res = await loopbackFetch()(
      `http://a.example.com:${port}/redirect?to=/echo`,
      { redirect: "manual" }
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/echo");
  });

  test("timeoutMs and signal abort the request", async () => {
    await expect(
      loopbackFetch({ timeoutMs: 100 })(`http://a.example.com:${port}/slow`)
    ).rejects.toMatchObject({ name: expect.stringMatching(/Timeout|Abort/) });
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 50);
    await expect(
      loopbackFetch()(`http://a.example.com:${port}/slow`, {
        signal: controller.signal,
      })
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  test("decodes compressed bodies like fetch", async () => {
    const res = await loopbackFetch()(`http://a.example.com:${port}/gzip`);
    expect(res.headers.get("content-encoding")).toBe("gzip");
    expect(await res.text()).toBe("compressed hello");
  });

  test.each([
    ["string", "hello", "hello", /text\/plain/],
    ["Uint8Array", new TextEncoder().encode("bytes"), "bytes", undefined],
    [
      "ArrayBuffer",
      new TextEncoder().encode("buffer").buffer,
      "buffer",
      undefined,
    ],
    ["URLSearchParams", new URLSearchParams({ a: "1" }), "a=1", /urlencoded/],
    [
      "Blob",
      new Blob(["blob"], { type: "text/x-blob" }),
      "blob",
      /text\/x-blob/,
    ],
  ])("sends a %s body", async (_name, body, expected, contentType) => {
    const res = await loopbackFetch()(`http://a.example.com:${port}/echo`, {
      method: "POST",
      body: body as BodyInit,
    });
    const echoed = await res.json();
    expect(echoed.body).toBe(expected);
    if (contentType)
      expect(echoed.headers["content-type"]).toMatch(contentType);
  });

  test("sends FormData and stream bodies", async () => {
    const form = new FormData();
    form.append("field", "value");
    const formRes = await loopbackFetch()(`http://a.example.com:${port}/echo`, {
      method: "POST",
      body: form,
    });
    const formEcho = await formRes.json();
    expect(formEcho.headers["content-type"]).toMatch(/multipart\/form-data/);
    expect(formEcho.body).toContain("value");

    const streamRes = await loopbackFetch()(
      `http://a.example.com:${port}/echo`,
      {
        method: "POST",
        body: new Blob(["streamed"]).stream(),
        duplex: "half",
      } as RequestInit
    );
    expect((await streamRes.json()).body).toBe("streamed");
  });

  test("accepts a Request", async () => {
    const res = await loopbackFetch()(
      new Request(`http://a.example.com:${port}/echo`, {
        method: "PUT",
        body: "from request",
      })
    );
    const body = await res.json();
    expect(body.method).toBe("PUT");
    expect(body.body).toBe("from request");
  });

  test("returns null bodies and every header value", async () => {
    const safeFetch = loopbackFetch();
    const empty = await safeFetch(`http://a.example.com:${port}/empty`);
    expect(empty.status).toBe(204);
    expect(empty.body).toBeNull();
    const head = await safeFetch(`http://a.example.com:${port}/echo`, {
      method: "HEAD",
    });
    expect(head.body).toBeNull();
    const cookies = await safeFetch(`http://a.example.com:${port}/cookies`);
    expect(cookies.headers.getSetCookie()).toEqual(["a=1", "b=2"]);
  });

  test("rejects a status Response can't represent", async () => {
    await expect(
      loopbackFetch()(`http://a.example.com:${port}/odd-status`)
    ).rejects.toThrow(RangeError);
  });

  test("fails closed on Node.js without process.getBuiltinModule", async () => {
    const { getBuiltinModule } = process;
    Object.defineProperty(process, "getBuiltinModule", {
      value: undefined,
      configurable: true,
    });
    try {
      await expect(createSafeFetch()("https://example.com/")).rejects.toThrow(
        /Node\.js 20\.16/
      );
    } finally {
      Object.defineProperty(process, "getBuiltinModule", {
        value: getBuiltinModule,
        configurable: true,
      });
    }
  });

  test("rejects schemes outside the policy", async () => {
    await expect(createSafeFetch()("file:///etc/passwd")).rejects.toThrow(
      /scheme/
    );
  });
});

describe("validateSafeUrlAsync", () => {
  test("rejects a hostname that resolves to a private address", async () => {
    mockDns(["192.168.1.10"]);
    await expect(
      validateSafeUrlAsync("https://internal.example.com")
    ).rejects.toThrow(/private IP/);
  });

  test("accepts a hostname that resolves to a public address", async () => {
    mockDns(["93.184.216.34"]);
    await expect(validateSafeUrlAsync("https://example.com/x")).resolves.toBe(
      "https://example.com/x"
    );
  });

  test("skips resolution for allowedHosts", async () => {
    mockDns(["10.0.0.5"]);
    await expect(
      validateSafeUrlAsync("https://models.internal", {
        allowedHosts: ["models.internal"],
      })
    ).resolves.toBe("https://models.internal");
  });
});
