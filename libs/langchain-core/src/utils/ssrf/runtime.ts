import type * as Dns from "node:dns";
import type * as Http from "node:http";
import type * as Https from "node:https";
import type * as Stream from "node:stream";
import type * as Zlib from "node:zlib";
import { addressBlockReason, type ResolvedSSRFPolicy } from "./policy.js";

export interface ResolvedAddress {
  address: string;
  family: 4 | 6;
}

interface BunGlobal {
  dns: {
    lookup(
      hostname: string,
      options?: { family?: 0 | 4 | 6 }
    ): Promise<{ address: string; family: 4 | 6 }[]>;
  };
}

interface NodeProcess {
  release?: { name?: string };
  versions?: Record<string, string | undefined>;
  title?: string;
  getBuiltinModule?: (id: string) => unknown;
}

const runtimeGlobals = globalThis as {
  process?: NodeProcess;
  Bun?: BunGlobal;
  Deno?: unknown;
  EdgeRuntime?: unknown;
};

/**
 * True on Node.js itself, not on Bun, Deno, Cloudflare Workers or an edge
 * runtime that emulates parts of `process`.
 */
export function isNodeRuntime(): boolean {
  const proc = runtimeGlobals.process;
  return (
    proc?.release?.name === "node" &&
    !proc.versions?.bun &&
    !proc.versions?.deno &&
    proc.title !== "workerd" &&
    runtimeGlobals.Bun === undefined &&
    runtimeGlobals.Deno === undefined &&
    runtimeGlobals.EdgeRuntime === undefined
  );
}

export function getBun(): BunGlobal | undefined {
  return runtimeGlobals.Bun;
}

export interface NodeBuiltins {
  dns: typeof Dns;
  http: typeof Http;
  https: typeof Https;
  stream: typeof Stream;
  zlib: typeof Zlib;
}

/** Node builtins, loaded without a static import so bundles for other runtimes still load. */
export function getNodeBuiltins(): NodeBuiltins {
  const load = runtimeGlobals.process?.getBuiltinModule;
  if (typeof load !== "function") {
    // Without it the address can't be checked, so refuse rather than check only the URL.
    throw new Error(
      "createSafeFetch needs Node.js 20.16 or later (process.getBuiltinModule). Pass your own fetch to use an older Node.js."
    );
  }
  return {
    dns: load("node:dns") as typeof Dns,
    http: load("node:http") as typeof Http,
    https: load("node:https") as typeof Https,
    stream: load("node:stream") as typeof Stream,
    zlib: load("node:zlib") as typeof Zlib,
  };
}

export type HostResolver = (hostname: string) => Promise<ResolvedAddress[]>;

/** Resolve every address with the system resolver, so /etc/hosts applies as it does for fetch. */
export function createNodeResolver(dns: typeof Dns): HostResolver {
  return async (hostname) => {
    const addresses = await dns.promises.lookup(hostname, {
      all: true,
      verbatim: true,
    });
    if (addresses.length === 0) {
      throw new Error(`Could not resolve hostname: ${hostname}`);
    }
    return addresses.map(({ address, family }) => ({
      address,
      family: family === 6 ? 6 : 4,
    }));
  };
}

export function createBunResolver(bun: BunGlobal): HostResolver {
  return async (hostname) => {
    const addresses = await bun.dns.lookup(hostname);
    if (addresses.length === 0) {
      throw new Error(`Could not resolve hostname: ${hostname}`);
    }
    return addresses.map(({ address, family }) => ({ address, family }));
  };
}

/**
 * Resolve `hostname` and refuse it if any address is blocked by the policy.
 * Checking every address means a name can't mix a public address with a
 * private one.
 */
export async function resolveChecked(
  resolve: HostResolver,
  hostname: string,
  policy: ResolvedSSRFPolicy
): Promise<ResolvedAddress[]> {
  const addresses = await resolve(hostname);
  for (const { address } of addresses) {
    const reason = addressBlockReason(address, policy);
    if (reason) throw new Error(`${hostname} resolves to ${reason}`);
  }
  return addresses;
}
