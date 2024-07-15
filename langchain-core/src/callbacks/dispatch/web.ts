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
  const callbackManager = await getCallbackManagerForConfig(config);
  const parentRunId = callbackManager?.getParentRunId();
  // We want to get the callback manager for the parent run.
  // This is a work-around for now to be able to dispatch adhoc events from
  // within a tool or a lambda and have the metadata events associated
  // with the parent run rather than have a new run id generated for each.
  if (callbackManager === undefined || parentRunId === undefined) {
    throw new Error(
      [
        "Unable to dispatch a custom event without a parent run id.",
        "This function can only be called from within an existing run (e.g.,",
        "inside a tool or a RunnableLambda).",
        `\n\nIf you continue to see this error, please import from "@langchain/core/callbacks/dispatch/web"`,
        "and explicitly pass in a config parameter.",
      ].join(" ")
    );
  }
  // We pass parent id as the current run id here intentionally since events dispatch
  // from within things like RunnableLambda
  await callbackManager.handleCustomEvent?.(name, payload, parentRunId);
}
