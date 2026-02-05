import {
  type RunnableConfig,
  getCallbackManagerForConfig,
} from "../../runnables/config.js";

/**
 * Dispatch a custom event. Requires an explicit config object.
 * @param name The name of the custom event.
 * @param payload The data for the custom event.
 *   Ideally should be JSON serializable to avoid serialization issues downstream, but not enforced.
 * @param config Config object.
 *
 * @example
 * ```typescript
 * import { dispatchCustomEvent } from "@langchain/core/callbacks/dispatch";
 *
 * const foo = RunnableLambda.from(async (input: string, config?: RunnableConfig) => {
 *   await dispatchCustomEvent(
 *     "my_custom_event",
 *     { arbitraryField: "someval" },
 *     config
 *   );
 *   return input;
 * });
 *
 * const callbacks = [{
 *   handleCustomEvent: (eventName: string, payload: any) => {
 *     // Logs "my_custom_event" and { arbitraryField: "someval" }
 *     console.log(eventName, payload);
 *   }
 * }];
 *
 * await foo.invoke("hi", { callbacks })
 * ```
 */
export async function dispatchCustomEvent(
  name: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
  config?: RunnableConfig
) {
  if (config === undefined) {
    throw new Error(
      [
        "Unable to dispatch a custom event without a parent run id.",
        `"dispatchCustomEvent" can only be called from within an existing run (e.g.,`,
        "inside a tool or a RunnableLambda).",
        `\n\nIf you continue to see this error, please import from "@langchain/core/callbacks/dispatch/web"`,
        "and explicitly pass in a config parameter.",
        `\n\nOr, if you are calling this from a custom tool, ensure you're using the "tool" helper constructor as documented here:`,
        "\n  |",
        "\n  └-> https://js.langchain.com/docs/how_to/custom_tools#tool-function",
        "\n",
      ].join(" ")
    );
  }
  const callbackManager = await getCallbackManagerForConfig(config);
  const parentRunId = callbackManager?.getParentRunId();
  // We pass parent id as the current run id here intentionally since events dispatch
  // from within things like RunnableLambda
  if (callbackManager !== undefined && parentRunId !== undefined) {
    await callbackManager.handleCustomEvent?.(name, payload, parentRunId);
  }
}
