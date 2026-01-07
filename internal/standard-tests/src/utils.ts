import { BaseCallbackHandler } from "@langchain/core/callbacks/base";
import { Serialized } from "@langchain/core/load/serializable";
import { BaseMessage } from "@langchain/core/messages";

/**
 * A test callback handler for capturing extra parameters passed to chat model runs.
 *
 * This handler is primarily used in tests to collect and expose any extra parameters
 * provided to chat model calls, such as structured output format details.
 *
 * This class should be extended as the needs of the standard tests change.
 *
 * @example
 * const handler = new TestCallbackHandler();
 * // Pass handler in call options to a model invocation
 * model.invoke(input, { callbacks: [handler] });
 * // After invocation, access handler.extraParams for collected params
 */
export class TestCallbackHandler extends BaseCallbackHandler {
  name = "TestCallbackHandler";

  /**
   * Internal array to store extra parameters from each chat model start event.
   * @internal
   */
  _extraParams: Array<Record<string, unknown>> = [];

  /**
   * Returns a single object containing all accumulated extra parameters,
   * merged together. If multiple runs provide extra parameters, later
   * values will overwrite earlier ones for the same keys.
   *
   * @returns {Record<string, unknown>} The merged extra parameters.
   */
  get extraParams(): Record<string, unknown> {
    return this._extraParams.reduce(Object.assign, {});
  }

  handleChatModelStart(
    _llm: Serialized,
    _messages: BaseMessage[][],
    _runId: string,
    _parentRunId?: string,
    extraParams?: Record<string, unknown>,
    _tags?: string[],
    _metadata?: Record<string, unknown>,
    _runName?: string
  ) {
    if (extraParams) this._extraParams.push(extraParams);
  }
}
