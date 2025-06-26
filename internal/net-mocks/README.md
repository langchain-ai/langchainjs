# @langchain/net-mocks

This is an internal utility used within LangChain to record & mock network activity for use in tests. Here's how it works:

1. **Record:** When running tests for the first time, `net-mocks` intercepts outgoing HTTP requests and records them, along with the corresponding responses, into a `.har` file. These files are stored in a `__snapshots__` directory (by default) alongside the tests.
2. **Replay:** On subsequent test runs, `net-mocks` intercepts the same HTTP requests but instead of hitting the actual API, it finds a matching request in the `.har` file and returns the recorded response. This makes tests deterministic and runnable offline.
3. **Refresh:** If the underlying API changes, or tests are slightly modified, then the matching function between the stored and actual request becomes falsy and data is automatically re-fetched (or will reject the test if configured)
   - Mainstream model providers that use stainless as their sdk backing (openAI, anthropic) typically pin a `sdk-version` or `api-version` header that gets sent with requests. Once those change (like by an sdk upgrade), that means that the network activity stored with a test will automatically be refetched. This makes it easy to mocked tests up-to-date with the latest API changes.
   - This tool also involves the concept of "stale" requests. If a request becomes older than a pre-determined interval, then we either refetch the request or reject the test based on the configuration. This just acts as an extra sanity-check to protect from sneaky API changes.

## 📚 Usage guide

This utility is meant to have an easy API so that it can work as a "drop-in" replacement for our existing test suites.

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { net } from "@langchain/net-mocks";
import { ChatAnthropic } from "../chat_models";

beforeAll(() =>
  net.setupVitest(...)
});

describe("ChatAnthropic", () => {
  it("should work as expected", async () => {
    // This binds the network listener to the current test context
    await net.vcr();

    const model = new ChatAnthropic({
      model: "claude-3-5-sonnet-20240620",
    });
    const message = new HumanMessage("do you know the muffin man");
    const result = await model.invoke([message]);

    expect(result.content).toBeDefined();
  });
});
```

### Options

Options are defined by collapsing a set of default options, the options provided in `net.setupVitest`, and the options provided in `net.vcr`. That resulting config object determines a couple of behaviors:

<details>
<summary>Options config</summary>

```ts
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
```

</details>

## 🦄 Other goodies

### Network timings

As apart of the HAR spec, complete archives come with fields that describe the timing of a request/response pair. When `useTimings` is set to `true` in vcr options, the resulting response object returned internally is delayed according to those timings to simulate real network delay.

Additionally when a response comes back with `Content-Type: text/event-stream` (a common format for streaming responses), we store the timings of each chunk as apart of the stored response body. On followup test runs (where `useTimings: true`), we replay the chunks as if we were streaming actual data over the network. This just better helps us model real world environments and detect race conditions if they exist.

### Using dev tools

HAR is a lesser known web standard that has its own place in modern web browser devtools, and its the format that we're using to retain network activity for later runs. This means that we can inspect all network transactions that occured in a test directly in the browser.

<video src="https://github.com/user-attachments/assets/36de46b7-d9d6-408a-9d06-4185dd990020" controls style="max-width: 100%;">
  Your browser does not support the video tag.
</video>
