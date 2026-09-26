import { Runnable, type RunnableConfig } from "@langchain/core/runnables";
import {
  AsyncCaller,
  type AsyncCallerParams,
} from "@langchain/core/utils/async_caller";
import { getEnvironmentVariable, isBrowser } from "@langchain/core/utils/env";

import {
  parseQuestions,
  serializeQuestion,
  type ClassificationResponse,
  type Question,
  type ValidatedQuestions,
} from "./types.js";
import { buildHeaders, parseResponse, SYSTEMONE_PATH } from "./utils/client.js";
import {
  sanitizeEndpoint,
  TypeSafeAPIConnectionError,
  TypeSafeAPITimeoutError,
  TypeSafeError,
} from "./utils/errors.js";
import { serializeState, type State } from "./utils/state.js";

const DEFAULT_BASE_URL = "https://api.typesafe.ai";
const DEFAULT_MODEL = "jev-latest";
const DEFAULT_TIMEOUT_MS = 30_000;

export interface TypeSafeClassifierCallOptions extends RunnableConfig {}

export interface TypeSafeClassifierFields extends AsyncCallerParams {
  /** The questions to ask. At least one is required. */
  questions: Record<string, Question>;
  /** Model or alias. Defaults to `jev-latest`. */
  model?: string;
  /** Falls back to the `TYPESAFE_API_KEY` environment variable. */
  apiKey?: string;
  /** Falls back to `TYPESAFE_BASE_URL`, then `https://api.typesafe.ai`. */
  baseUrl?: string;
  /** Per-request timeout in **milliseconds**. Defaults to 30000. */
  timeout?: number;
  /** Custom transport, for tests, proxies or shared connection pools. */
  fetch?: typeof fetch;
  /**
   * Whether to permit use in a browser, where the API key would be
   * exposed to anyone who can read the bundle.
   *
   * Defaults to `true`, matching every other LangChain.js provider. Set
   * it to `false` to adopt the stricter posture the vendor SDK takes.
   */
  dangerouslyAllowBrowser?: boolean;
}

/**
 * Classifies unstructured state into typed, probabilistic answers using
 * TypeSafe's System One models.
 *
 * Questions in one call are evaluated in parallel by the model, so
 * batching many questions into a single classifier is far cheaper than
 * making one call per question.
 *
 * @example
 * ```ts
 * const classifier = new TypeSafeClassifier({
 *   questions: {
 *     urgent: { type: "noul", instructions: "Is this urgent?" },
 *   },
 * });
 * const result = await classifier.invoke("My payouts have been failing.");
 * ```
 */
export class TypeSafeClassifier extends Runnable<
  State,
  ClassificationResponse,
  TypeSafeClassifierCallOptions
> {
  static lc_name(): string {
    return "TypeSafeClassifier";
  }

  lc_serializable = true;

  lc_namespace = ["langchain", "classifiers", "typesafe"];

  get lc_secrets(): Record<string, string> {
    return { apiKey: "TYPESAFE_API_KEY" };
  }

  readonly questions: ValidatedQuestions;

  readonly model: string;

  readonly baseUrl: string;

  readonly timeout: number;

  // `declare` is load-bearing: the base tsconfig sets
  // `useDefineForClassFields: true`, so a normal field declaration would
  // emit an enumerable `undefined` at construction time before the
  // constructor body runs, which the non-enumerable `defineHidden` call
  // below could not undo. `declare` emits no code at all. See
  // `TypeSafeAPIError.body` in `utils/errors.ts` for the same pattern.
  /** Non-enumerable: `util.inspect`/`console.log` must never print it. */
  declare protected apiKey: string;

  protected caller: AsyncCaller;

  protected fetchImpl: typeof fetch;

  constructor(fields: TypeSafeClassifierFields) {
    // `Serializable`'s own constructor stores whatever is passed here
    // verbatim as `this.lc_kwargs` — a normal, enumerable property. If
    // `apiKey` rode along, `util.inspect(classifier)` would print it via
    // `lc_kwargs` even with the non-enumerable `this.apiKey` below.
    // `toJSON()`'s secret redaction is unaffected: it re-reads `apiKey`
    // from `this` (present, just hidden) whenever a secret's key is
    // missing from `lc_kwargs`, so the sentinel still appears in output.
    const { apiKey: _omittedFromKwargs, ...kwargsForSerialization } = fields;
    super(kwargsForSerialization);

    const allowBrowser = fields.dangerouslyAllowBrowser ?? true;
    if (!allowBrowser && isBrowser()) {
      throw new TypeSafeError(
        "TypeSafeClassifier is running in a browser, which would expose your API key to anyone using the page. Call the API from a server instead, or set `dangerouslyAllowBrowser: true` if you understand the risk."
      );
    }

    const apiKey =
      fields.apiKey ?? getEnvironmentVariable("TYPESAFE_API_KEY") ?? "";
    if (apiKey.trim().length === 0) {
      throw new TypeSafeError(
        "TypeSafe API key is required. Pass `apiKey` or set `TYPESAFE_API_KEY`."
      );
    }

    const model = (fields.model ?? DEFAULT_MODEL).trim();
    if (model.length === 0) {
      throw new TypeSafeError("TypeSafe model must not be empty.");
    }

    // `parseQuestions` throws a plain `Error` (it predates this package's
    // branded error subtree). Rethrown here as a `TypeSafeError` so the
    // whole constructor surface stays catchable via
    // `TypeSafeError.isInstance()`. The original message is preserved.
    let questions: ValidatedQuestions;
    try {
      questions = parseQuestions(fields.questions);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new TypeSafeError(message);
    }

    if (fields.timeout !== undefined && fields.timeout <= 0) {
      throw new TypeSafeError(
        "`timeout` must be a positive number of milliseconds."
      );
    }

    // Plain assignment would land on a normal enumerable property (see
    // the `declare` comment above), which is exactly what
    // `util.inspect`/`console.log` would then print. `apiKey` has no
    // Node special case the way `Error.prototype.cause` does (verified
    // empirically), so non-enumerability genuinely hides it here.
    Object.defineProperty(this, "apiKey", {
      value: apiKey,
      enumerable: false,
      writable: false,
      configurable: true,
    });
    this.model = model;
    this.questions = questions;
    let baseUrl =
      fields.baseUrl ??
      getEnvironmentVariable("TYPESAFE_BASE_URL") ??
      DEFAULT_BASE_URL;
    // Trimmed with a loop rather than /\/+$/, which backtracks quadratically
    // on a long run of trailing slashes (CodeQL js/polynomial-redos).
    while (baseUrl.endsWith("/")) baseUrl = baseUrl.slice(0, -1);
    this.baseUrl = baseUrl;
    this.timeout = fields.timeout ?? DEFAULT_TIMEOUT_MS;
    // Not two fetch paths — one, resolved late. Storing `globalThis.fetch`
    // directly would capture whatever is installed at construction time,
    // so a later `vi.spyOn(globalThis, "fetch")` (or any runtime polyfill)
    // would never be seen. The wrapper defers the lookup to call time.
    this.fetchImpl =
      fields.fetch ?? ((input, init) => globalThis.fetch(input, init));
    // The vendor's own TypeScript SDK caps retries at 2
    // (DEFAULT_RETRY_POLICY.maxRetries). Core defaults to 6, which against a
    // 70-500ms model means seconds of backoff before the caller sees an
    // error — and every attempt re-sends the full conversation state.
    // Still overridable through AsyncCallerParams.
    // Spread first, then override: a spread copies own keys even when the
    // value is `undefined`, so `{ maxRetries: 2, ...fields }` would let an
    // ordinary pass-through like `{ maxRetries: config.maxRetries }` restore
    // core's default of 6.
    this.caller = new AsyncCaller({
      ...fields,
      maxRetries: fields.maxRetries ?? 2,
    });
  }

  async invoke(
    input: State,
    options?: Partial<TypeSafeClassifierCallOptions>
  ): Promise<ClassificationResponse> {
    return this._callWithConfig(
      (state: State) => this.classify(state, options?.signal),
      input,
      options
    );
  }

  /** Builds the request body. Question key order is significant. */
  protected payload(state: State): string {
    // Null-prototype for the same reason as `serializeState`: an own
    // `__proto__` question id would otherwise hit the inherited setter and
    // drop that question from the request without any error.
    const questions: Record<string, unknown> = Object.create(null);
    for (const [id, question] of Object.entries(this.questions)) {
      questions[id] = serializeQuestion(question);
    }
    return JSON.stringify({
      state: serializeState(state),
      model: this.model,
      questions,
    });
  }

  protected async classify(
    state: State,
    signal?: AbortSignal
  ): Promise<ClassificationResponse> {
    const url = `${this.baseUrl}${SYSTEMONE_PATH}`;
    const endpoint = sanitizeEndpoint("POST", url);
    const body = this.payload(state);

    // AsyncCaller retries outside this closure, so the attempt number is
    // tracked here to populate the retry-count header the SDK sends.
    let attempt = 0;

    return this.caller.callWithOptions({ signal }, async () => {
      const retryCount = attempt;
      attempt += 1;

      // `AbortSignal.any` is not available on the Node 20.0 floor this
      // package declares (`engines.node: ">=20"`) — it landed in a later
      // 20.x minor. Forward both signals into a fresh controller by hand
      // instead, so the request aborts on either a caller-supplied signal
      // or the per-request timeout.
      const controller = new AbortController();
      const timeoutSignal = AbortSignal.timeout(this.timeout);
      timeoutSignal.addEventListener(
        "abort",
        () => controller.abort(timeoutSignal.reason),
        { once: true }
      );
      if (signal?.aborted) {
        controller.abort(signal.reason);
      } else {
        signal?.addEventListener(
          "abort",
          () => controller.abort(signal.reason),
          { once: true }
        );
      }

      try {
        const response = await this.fetchImpl(url, {
          method: "POST",
          headers: buildHeaders({ apiKey: this.apiKey, retryCount }),
          body,
          signal: controller.signal,
        });
        // Parsing is inside the guarded block on purpose. `fetch` resolves
        // once headers arrive, not once the body has been read, so a server
        // that sends headers and then stalls — or a connection that drops
        // mid-body — fails here, not at the call above. Outside this block
        // the caller would receive a raw AbortError instead of
        // TypeSafeAPITimeoutError.
        return await parseResponse(response, endpoint);
      } catch (error) {
        // Anything already mapped to this package's own error type (every
        // non-2xx response, and response-schema failures) passes through
        // untouched; only transport-level failures get translated.
        if (TypeSafeError.isInstance(error)) {
          throw error;
        }
        if (timeoutSignal.aborted) {
          throw new TypeSafeAPITimeoutError(this.timeout, { cause: error });
        }
        if (signal?.aborted) {
          throw error;
        }
        throw new TypeSafeAPIConnectionError(undefined, { cause: error });
      }
    });
  }
}
