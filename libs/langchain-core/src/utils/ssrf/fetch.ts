import type { IncomingMessage } from "node:http";
import type { LookupFunction } from "node:net";
import type * as Zlib from "node:zlib";
import {
  checkUrl,
  isAllowedHost,
  isIpLiteral,
  normalizeHostname,
  resolvePolicy,
  type ResolvedSSRFPolicy,
  type SSRFPolicy,
} from "./policy.js";
import {
  createBunResolver,
  createNodeResolver,
  getBun,
  getNodeBuiltins,
  isNodeRuntime,
  resolveChecked,
  type NodeBuiltins,
} from "./runtime.js";

export interface SafeFetchOptions {
  /** Which URLs and addresses may be fetched. */
  policy?: SSRFPolicy;
  /** Shorthand for `policy.allowedHosts`; the two lists are merged. */
  allowedHosts?: string[];
  /** Redirects to follow before failing. Defaults to 5. */
  maxRedirects?: number;
  /** Abort the request, redirects included, after this many milliseconds. */
  timeoutMs?: number;
}

export type SafeFetch = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>;

interface PreparedRequest {
  url: string;
  method: string;
  headers: Headers;
  body: Uint8Array | ReadableStream<Uint8Array> | null;
  redirect: RequestRedirect;
  signal?: AbortSignal;
}

type Sender = (
  url: URL,
  request: PreparedRequest,
  signal: AbortSignal | undefined
) => Promise<Response>;

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const NULL_BODY_STATUSES = new Set([204, 205, 304]);
const CROSS_ORIGIN_HEADERS =
  /^(accept(-.*)?|content-(type|language|encoding)|user-agent)$/i;
const DECODERS: Record<string, keyof typeof Zlib> = {
  gzip: "createGunzip",
  "x-gzip": "createGunzip",
  deflate: "createInflate",
  br: "createBrotliDecompress",
};

/**
 * Create a `fetch` for URLs that come from model output, message content or
 * user input. Every request, and every redirect hop, is checked against the
 * policy before anything is sent.
 *
 * On Node.js the hostname is resolved, every address is checked, and the
 * socket connects to a checked address, so the name can't resolve somewhere
 * else between the check and the connection. On Bun the request goes to the
 * checked address with the original `Host` and TLS server name. Other runtimes
 * (browsers, Deno, Cloudflare Workers, edge) can't resolve DNS, so only the
 * URL is checked there; rely on the platform's network egress controls.
 *
 * @example
 * ```typescript
 * const safeFetch = createSafeFetch({ allowedHosts: ["models.internal"] });
 * const res = await safeFetch(urlFromModel);
 * ```
 */
export function createSafeFetch(options: SafeFetchOptions = {}): SafeFetch {
  const policy = resolvePolicy({
    ...options.policy,
    allowedHosts: [
      ...(options.policy?.allowedHosts ?? []),
      ...(options.allowedHosts ?? []),
    ],
  });
  const maxRedirects = options.maxRedirects ?? 5;
  let send: Sender | undefined;

  return async (input, init) => {
    send ??= createSender(policy);
    const request = await prepareRequest(input, init);
    const signal = combineSignals(request.signal, options.timeoutMs);
    let url = checkUrl(request.url, policy);

    for (let redirects = 0; ; redirects += 1) {
      const res = await send(url, request, signal);
      const location = res.headers.get("location");
      if (
        !REDIRECT_STATUSES.has(res.status) ||
        location === null ||
        request.redirect === "manual"
      ) {
        Object.defineProperty(res, "url", { value: url.href });
        return res;
      }
      await res.body?.cancel();
      if (request.redirect === "error") {
        throw new TypeError(`Redirect to ${location} is not allowed`);
      }
      if (redirects >= maxRedirects) {
        throw new Error(`Too many redirects (more than ${maxRedirects})`);
      }
      const next = checkUrl(new URL(location, url), policy);

      if (res.status <= 303 && request.method !== "HEAD") {
        request.method = "GET";
        request.body = null;
        for (const name of [...request.headers.keys()]) {
          if (name.startsWith("content-")) request.headers.delete(name);
        }
      } else if (request.body instanceof ReadableStream) {
        throw new TypeError(
          "Cannot follow a redirect with a streamed request body"
        );
      }
      if (next.origin !== url.origin) {
        for (const name of [...request.headers.keys()]) {
          if (!CROSS_ORIGIN_HEADERS.test(name)) request.headers.delete(name);
        }
      }
      url = next;
    }
  };
}

function createSender(policy: ResolvedSSRFPolicy): Sender {
  if (isNodeRuntime()) return createNodeSender(policy);
  const bun = getBun();
  return bun ? createBunSender(bun, policy) : platformSend;
}

async function prepareRequest(
  input: string | URL | Request,
  init: RequestInit = {}
): Promise<PreparedRequest> {
  const source = input instanceof Request ? input : undefined;
  const headers = new Headers(init.headers ?? source?.headers);
  let body: BodyInit | null =
    init.body !== undefined
      ? init.body
      : source?.body
        ? await source.arrayBuffer()
        : null;
  if (body !== null && !(body instanceof ReadableStream)) {
    // Response does the encoding fetch would: strings, FormData, URLSearchParams, Blob.
    const encoded = new Response(body);
    const contentType = encoded.headers.get("content-type");
    if (contentType && !headers.has("content-type")) {
      headers.set("content-type", contentType);
    }
    body = new Uint8Array(await encoded.arrayBuffer());
  }
  return {
    url: source ? source.url : input.toString(),
    method: (init.method ?? source?.method ?? "GET").toUpperCase(),
    headers,
    body: body as PreparedRequest["body"],
    redirect: init.redirect ?? source?.redirect ?? "follow",
    signal: init.signal ?? source?.signal,
  };
}

function combineSignals(
  signal: AbortSignal | undefined,
  timeoutMs: number | undefined
): AbortSignal | undefined {
  const signals = [
    signal,
    timeoutMs === undefined ? undefined : AbortSignal.timeout(timeoutMs),
  ].filter((s): s is AbortSignal => s !== undefined);
  return signals.length > 1 ? AbortSignal.any(signals) : signals[0];
}

async function platformSend(
  url: URL,
  request: PreparedRequest,
  signal: AbortSignal | undefined,
  extra: Record<string, unknown> = {}
): Promise<Response> {
  const res = await fetch(url, {
    method: request.method,
    headers: request.headers,
    body: request.body,
    signal,
    redirect: "manual",
    ...(request.body instanceof ReadableStream ? { duplex: "half" } : {}),
    ...extra,
  } as RequestInit);
  if (res.type === "opaqueredirect") {
    throw new Error(
      `${url.href} redirected, and this runtime doesn't expose redirects to check`
    );
  }
  return res;
}

function createNodeSender(policy: ResolvedSSRFPolicy): Sender {
  const builtins = getNodeBuiltins();
  const { http, https } = builtins;
  const resolve = createNodeResolver(builtins.dns);
  // Own agents, so a pooled socket is never one opened without this lookup.
  const httpAgent = new http.Agent({ keepAlive: true });
  const httpsAgent = new https.Agent({ keepAlive: true });
  // The socket connects to whatever this returns, so it only returns checked addresses.
  const lookup: LookupFunction = (hostname, options, callback) => {
    resolveChecked(resolve, hostname, policy).then(
      (resolved) => {
        const family = options.family === 6 ? 6 : options.family === 4 ? 4 : 0;
        const addresses = family
          ? resolved.filter((a) => a.family === family)
          : resolved;
        if (addresses.length === 0) {
          callback(new Error(`No IPv${family} address for ${hostname}`), "");
        } else if (options.all) {
          callback(null, addresses);
        } else {
          callback(null, addresses[0].address, addresses[0].family);
        }
      },
      (error: Error) => callback(error, "")
    );
  };

  return (url, request, signal) =>
    new Promise((resolvePromise, reject) => {
      const host = normalizeHostname(url.hostname);
      const pinned = !isIpLiteral(host) && !isAllowedHost(host, policy);
      const headers = Object.fromEntries(request.headers);
      headers["accept-encoding"] ??= "gzip, deflate, br";
      if (request.body instanceof Uint8Array) {
        headers["content-length"] = String(request.body.byteLength);
      }
      const secure = url.protocol === "https:";
      const outgoing = (secure ? https : http).request(
        url,
        {
          method: request.method,
          headers,
          agent: secure ? httpsAgent : httpAgent,
          lookup: pinned ? lookup : undefined,
          signal,
        },
        (res) => resolvePromise(toResponse(res, request.method, builtins))
      );
      outgoing.on("error", reject);
      if (request.body instanceof ReadableStream) {
        const { stream } = builtins;
        stream.pipeline(
          stream.Readable.fromWeb(request.body as never),
          outgoing,
          () => {}
        );
      } else {
        outgoing.end(request.body ?? undefined);
      }
    });
}

function toResponse(
  res: IncomingMessage,
  method: string,
  { stream, zlib }: NodeBuiltins
): Response {
  const headers = new Headers();
  for (let i = 0; i < res.rawHeaders.length; i += 2) {
    headers.append(res.rawHeaders[i], res.rawHeaders[i + 1]);
  }
  const status = res.statusCode ?? 502;
  const hasBody = method !== "HEAD" && !NULL_BODY_STATUSES.has(status);
  if (!hasBody) {
    res.resume();
    return new Response(null, {
      status,
      statusText: res.statusMessage,
      headers,
    });
  }
  // Decode the body like fetch does, keeping the content-encoding header.
  const decoder =
    DECODERS[headers.get("content-encoding")?.trim().toLowerCase() ?? ""];
  const body = decoder
    ? stream.pipeline(res, (zlib[decoder] as () => Zlib.Gunzip)(), () => {})
    : res;
  return new Response(stream.Readable.toWeb(body) as ReadableStream, {
    status,
    statusText: res.statusMessage,
    headers,
  });
}

function createBunSender(
  bun: Parameters<typeof createBunResolver>[0],
  policy: ResolvedSSRFPolicy
): Sender {
  const resolve = createBunResolver(bun);
  return async (url, request, signal) => {
    const host = normalizeHostname(url.hostname);
    if (isIpLiteral(host) || isAllowedHost(host, policy)) {
      return platformSend(url, request, signal);
    }
    // Bun connects to the address in the URL, sends Host, and uses serverName for SNI and certificate checks.
    const [{ address, family }] = await resolveChecked(resolve, host, policy);
    const target = new URL(url);
    target.hostname = family === 6 ? `[${address}]` : address;
    const headers = new Headers(request.headers);
    headers.set("host", url.host);
    return platformSend(
      target,
      { ...request, headers },
      signal,
      url.protocol === "https:" ? { tls: { serverName: host } } : {}
    );
  };
}
