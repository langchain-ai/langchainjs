import { HARArchive, HAREntry } from "./spec";
import {
  encodeHARRequest,
  encodeHARResponse,
  entryIsStale,
  matchRequestEntryPredicate,
  readableHARResponseStream,
} from "./request";
import { iife, PromiseOrValue } from "./utils";
import {
  EnvironmentBatchInterceptor,
  getArchiveStore,
  getEnvironmentVariable,
  getInterceptor,
} from "./env";

/**
 * Interface representing a storage mechanism for HAR archives.
 * Provides methods to retrieve, list, and save HAR archives by key.
 */
export interface ArchiveStore {
  /**
   * Retrieves a HAR log by its key.
   * @param {string} key - The identifier or filename of the HAR log to retrieve.
   * @returns {PromiseOrValue<HARArchive | undefined>} The HAR log associated with the given key.
   */
  get(key: string): PromiseOrValue<HARArchive | undefined>;

  /**
   * Saves a HAR log to the store under the specified key.
   * @param {string} key - The identifier or filename to save the HAR log under.
   * @param {HARArchive} log - The HAR log object to save.
   * @returns {PromiseOrValue<void>} A promise that resolves when the save is complete.
   */
  save(key: string, log: HARArchive): PromiseOrValue<void>;
}

/**
 * Strategy for handling stale cache entries:
 * - "reject": Reject the request if the entry is stale.
 * - "warn": Warn but allow the request.
 * - "refetch": Refetch the request from the network.
 * - "ignore": Ignore staleness and use the entry.
 */
type StaleStrategy = "reject" | "warn" | "refetch" | "ignore";
/**
 * Strategy for handling unmatched requests:
 * - "reject": Reject unmatched requests.
 * - "warn": Warn but allow unmatched requests.
 * - "fetch": Fetch the request from the network.
 */
type NoMatchStrategy = "reject" | "warn" | "fetch";

/**
 * Options for configuring network mocking and recording behavior.
 */
export type NetMockOptions = {
  /**
   /**
    * Maximum age (in milliseconds) for cached network entries before considered stale.
    * Can be set via the `MOCKS_MAX_AGE` environment variable.
    * @default '60 days'
    */
  maxAge: number;
  /**
   * Can be set via the `MOCKS_STALE` environment variable.
   * @default reject
   */
  stale: StaleStrategy;
  /**
   * Can be set via the `MOCKS_NO_MATCH` environment variable.
   * @default reject
   */
  noMatch: NoMatchStrategy;
  /**
   * Whether to mimick the timings of the original request.
   * Can be set via the `MOCKS_USE_TIMINGS` environment variable.
   * @default false
   */
  useTimings: boolean;
  /**
   * Output file path for saving the archive or mock data.
   * @default 'The current test name, or "archive" if no test name is available.'
   */
  out?: string;
  /**
   * List of header or body keys to include in request archives.
   * Can be set via the `MOCKS_INCLUDE_KEYS` environment variable.
   * @default []
   */
  includeKeys: string[];
};

export interface NetMockContextHooks {
  getTestPath(): string | undefined;
  getDefaultSource(): string | undefined;
  fail(message: string): void;
  warn(message: string): void;
  cleanup(fn: () => Promise<void>): void;
}

export class NetMockContext {
  interceptor: EnvironmentBatchInterceptor | null = null;

  hooks: NetMockContextHooks | null = null;

  _archivePromises: Promise<void>[] = [];

  _store: Promise<ArchiveStore> | null = null;

  get store() {
    if (this._store === null) this._store = getArchiveStore(this.hooks);
    return this._store;
  }

  /** @internal */
  private _defaultOptions: NetMockOptions = {
    maxAge: getEnvironmentVariable("MOCKS_MAX_AGE", (value) => {
      if (!value) return 1000 * 60 * 60 * 24 * 60; // 60 days
      return Number(value);
    }),
    stale: getEnvironmentVariable("MOCKS_STALE", (value) => {
      if (!value) return "reject";
      if (!["reject", "warn", "refetch", "ignore"].includes(value)) {
        throw new Error(`Invalid stale strategy: ${value}`);
      }
      return value as StaleStrategy;
    }),
    noMatch: getEnvironmentVariable("MOCKS_NO_MATCH", (value) => {
      if (!value) return "reject";
      if (!["reject", "warn", "fetch"].includes(value)) {
        throw new Error(`Invalid no match strategy: ${value}`);
      }
      return value as NoMatchStrategy;
    }),
    useTimings: getEnvironmentVariable("MOCKS_USE_TIMINGS", (value) => {
      if (value === undefined) return Boolean(false);
      return Boolean(value);
    }),
    includeKeys: getEnvironmentVariable("MOCKS_INCLUDE_KEYS", (value) => {
      if (!value) return [];
      return value.split(",");
    }),
  };

  /** @internal */
  private _mergeDefaultOptions(
    options?: Partial<NetMockOptions>
  ): NetMockOptions {
    return {
      ...this._defaultOptions,
      ...options,
    };
  }

  async vcr(source: string, options?: Partial<NetMockOptions>): Promise<void>;

  async vcr(options?: Partial<NetMockOptions>): Promise<void>;

  async vcr(
    sourceOrOptions?: string | Partial<NetMockOptions>,
    optionsArg?: Partial<NetMockOptions>
  ) {
    const options = this._mergeDefaultOptions(
      typeof sourceOrOptions === "object" ? sourceOrOptions : optionsArg
    );
    const source = iife(() => {
      if (typeof sourceOrOptions === "string") return sourceOrOptions;
      else if (options.out) return options.out;
      else return this.hooks?.getDefaultSource() ?? "archive";
    });

    const store = await this.store;
    const archive: HARArchive = (await store.get(source)) ?? {
      log: {
        version: "1.2",
        creator: {
          name: "langchain-net-mocks",
          version: "2025-06-23",
        },
        pages: [],
        entries: [],
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    this.interceptor?.on("request", async ({ request, controller }) => {
      // If the request has a passthrough header, we shouldn't try to intercept it
      if (request.headers.get("x-mock-passthrough") !== null) {
        request.headers.delete("x-mock-passthrough");
        return;
      }

      // MSW has some shortcomings when it comes to dealing with gzip
      // streams (teed readable streams don't take on the same semantics
      // because http streams use an internal prototype that plays nice with gunzip)
      // If you're getting 'incorrect header check' errors from node internals
      // then it's probably because the remote being fetched doesn't support
      // this header
      request.headers.set("accept-encoding", "identity");

      const encodedRequest = encodeHARRequest(
        request.clone(),
        options.includeKeys
      );

      const clonedRequest = request.clone();
      const clonedRequestBody = new Uint8Array(
        await clonedRequest.arrayBuffer()
      );
      const matchedEntry = archive.log.entries.find((entry) =>
        matchRequestEntryPredicate({
          request: clonedRequest,
          requestBody: clonedRequestBody,
          entry,
          includeKeys: options.includeKeys.filter(Boolean) as string[],
        })
      );

      let shouldFetch = false;

      // If the request matches an entry, we'll handle it according to the `stale` strategy
      if (matchedEntry) {
        const isStale = entryIsStale(matchedEntry, options.maxAge);
        const message = [
          `A stale entry was used to respond to a request:`,
          `  - URL: ${clonedRequest.url}`,
          `  - Request timestamp: ${matchedEntry.startedDateTime}`,
        ].join("\n");
        if (isStale) {
          if (options.stale === "reject") {
            controller.respondWith(new Response(message, { status: 400 }));
            this.hooks?.fail(message);
            return;
          } else if (options.stale === "warn") {
            this.hooks?.warn(message);
          } else if (options.stale === "refetch") {
            shouldFetch = true;
          }
        }
      }
      // If the request doesn't match an entry, we'll handle it according to the `noMatch` strategy
      else {
        const message = [
          `A request was made that did not match any stored entry:`,
          `  - URL: ${clonedRequest.url}`,
        ].join("\n");
        if (options.noMatch === "reject") {
          controller.respondWith(new Response(message, { status: 400 }));
          this.hooks?.fail(message);
          return;
        } else if (options.noMatch === "warn") {
          this.hooks?.warn(message);
          shouldFetch = true;
        } else if (options.noMatch === "fetch") {
          shouldFetch = true;
        }
      }

      // If we have a matched entry and we're not fetching, we can respond with the cached entry
      if (matchedEntry && !shouldFetch) {
        const httpHeaders: [string, string][] =
          matchedEntry.response.headers.map((header) => [
            header.name,
            header.value,
          ]);
        const httpResponse = new Response(
          readableHARResponseStream(matchedEntry, options.useTimings),
          {
            status: matchedEntry.response.status,
            statusText: matchedEntry.response.statusText,
            headers: httpHeaders,
          }
        );
        controller.respondWith(httpResponse);
        return;
      }
      // If we need to fetch, we'll need to make an actual fetch request and record the response
      else if (shouldFetch) {
        // Pin a header so that calling `fetch` doesn't cause an infinite loop
        request.headers.set("x-mock-passthrough", "1");

        const startTime = performance.now();
        const response = await fetch(request);
        const waitTime = performance.now() - startTime;

        const clonedResponse = response.clone();
        this._archivePromises.push(
          iife(async () => {
            const entry: HAREntry = {
              startedDateTime: new Date().toISOString(),
              time: performance.now() - startTime,
              request: await encodedRequest,
              response: await encodeHARResponse(
                clonedResponse,
                options.includeKeys
              ),
              cache: {},
              timings: {
                // `send` is the time it takes to send the request to the server (0 since we're not in a browser)
                send: 0,
                // `wait` is the time it takes to start a response from the server
                wait: waitTime,
                // `receive` is the time it takes for the entire response to be received
                receive: performance.now() - startTime,
              },
            };
            archive.log.entries.push(entry);
          })
        );

        controller.respondWith(response);
        return;
      }
      // All code paths should return, so we'll throw an error if we get here
      throw new Error("Unhandled request");
    });

    this.interceptor?.apply();

    this.hooks?.cleanup(async () => {
      this.interceptor?.removeAllListeners("request");
      await Promise.all(this._archivePromises);
      await store.save(source, archive);
    });
  }

  async setupVitest(options?: Partial<NetMockOptions>) {
    const { onTestFinished, expect } = await import("vitest");
    this.interceptor = await getInterceptor();
    this.interceptor.apply();
    this.hooks = {
      getTestPath: () => expect.getState().testPath,
      getDefaultSource: () => expect.getState().currentTestName,
      cleanup: onTestFinished,
      fail: (message) => {
        // This will mark the test as failed, but we don't want to do an explicit
        // assertion since that causes an error to be thrown, which if thrown within
        // the msw handler causes a retry loop with async-caller
        expect.soft(message).toBeUndefined();
      },
      // TODO: use vitest annotations
      warn: console.warn,
    };
    this._defaultOptions = this._mergeDefaultOptions(options);
  }
}

export const net = new NetMockContext();
