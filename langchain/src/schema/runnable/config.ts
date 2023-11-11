import {
  BaseCallbackConfig,
  CallbackManager,
} from "../../callbacks/manager.js";

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
