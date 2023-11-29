import {
  type BaseCallbackConfig,
  CallbackManager,
} from "../callbacks/manager.js";

export type RunnableConfig = BaseCallbackConfig;

export async function getCallbackMangerForConfig(config?: RunnableConfig) {
  return CallbackManager.configure(
    config?.callbacks,
    undefined,
    config?.tags,
    undefined,
    config?.metadata
  );
}

export function mergeConfigs<CallOptions extends RunnableConfig>(
  config: RunnableConfig,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options?: Record<string, any>
): Partial<CallOptions> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const copy: Record<string, any> = { ...config };
  if (options) {
    for (const key of Object.keys(options)) {
      if (key === "metadata") {
        copy[key] = { ...copy[key], ...options[key] };
      } else if (key === "tags") {
        copy[key] = (copy[key] ?? []).concat(options[key] ?? []);
      } else if (key === "callbacks") {
        const baseCallbacks = copy.callbacks;
        const theseCallbacks = options.callbacks ?? config.callbacks;
        // callbacks can be either undefined, Array<handler> or manager
        // so merging two callbacks values has 6 cases
        if (Array.isArray(theseCallbacks)) {
          if (!baseCallbacks) {
            copy.callbacks = theseCallbacks;
          } else if (Array.isArray(baseCallbacks)) {
            copy.callbacks = baseCallbacks.concat(theseCallbacks);
          } else {
            // baseCallbacks is a manager
            const manager = baseCallbacks.copy();
            for (const callback of theseCallbacks) {
              manager.addHandler(callback, true);
            }
            copy.callbacks = manager;
          }
        } else if (theseCallbacks) {
          // theseCallbacks is a manager
          if (!baseCallbacks) {
            copy.callbacks = theseCallbacks;
          } else if (Array.isArray(baseCallbacks)) {
            const manager = theseCallbacks.copy();
            for (const callback of baseCallbacks) {
              manager.addHandler(callback, true);
            }
            copy.callbacks = manager;
          } else {
            // baseCallbacks is also a manager
            copy.callbacks = new CallbackManager(theseCallbacks.parentRunId, {
              handlers: baseCallbacks.handlers.concat(theseCallbacks.handlers),
              inheritableHandlers: baseCallbacks.inheritableHandlers.concat(
                theseCallbacks.inheritableHandlers
              ),
              tags: Array.from(
                new Set(baseCallbacks.tags.concat(theseCallbacks.tags))
              ),
              inheritableTags: Array.from(
                new Set(
                  baseCallbacks.inheritableTags.concat(
                    theseCallbacks.inheritableTags
                  )
                )
              ),
              metadata: {
                ...baseCallbacks.metadata,
                ...theseCallbacks.metadata,
              },
            });
          }
        }
      } else {
        copy[key] = options[key] ?? copy[key];
      }
    }
  }
  return copy as Partial<CallOptions>;
}
