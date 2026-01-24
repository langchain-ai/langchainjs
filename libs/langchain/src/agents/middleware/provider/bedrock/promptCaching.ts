import {
  BaseMessage,
  HumanMessage,
  SystemMessage,
  AIMessage,
} from "@langchain/core/messages";

import { Runnable, RunnableConfig } from "@langchain/core/runnables";

export interface BedrockPromptCachingConfig {
  enableCaching?: boolean;
  minMessagesToCache?: number;
}

export function bedrockPromptCachingMiddleware(
  config: BedrockPromptCachingConfig = {}
) {
  const { enableCaching = true, minMessagesToCache = 2 } = config;

  return (runnable: Runnable<any, any>): Runnable<any, any> => {
    if (!enableCaching) {
      return runnable;
    }

    const originalInvoke = runnable.invoke.bind(runnable);
    const newRunnable = runnable.clone();

    newRunnable.invoke = async (input: any, options?: RunnableConfig) => {
      let messages: any[] = [];

      if (Array.isArray(input)) {
        messages = input;
      } else if (input && Array.isArray(input.messages)) {
        messages = input.messages;
      }

      if (messages.length >= minMessagesToCache) {
        // Iterate backwards to find the last cacheable message
        for (let i = messages.length - 1; i >= 0; i -= 1) {
          const message = messages[i];

          // Robust check for message type
          let msgType = "unknown";
          if (typeof message._getType === "function") {
            msgType = message._getType();
          } else if (message.type) {
            msgType = message.type;
          }

          const isCacheable =
            msgType === "human" || msgType === "system" || msgType === "ai";

          if (isCacheable) {
            if (typeof message.content === "string") {
              if (!message.additional_kwargs) {
                message.additional_kwargs = {};
              }

              message.additional_kwargs.cache_control = { type: "ephemeral" };
              break;
            }
          }
        }
      }

      return originalInvoke(input, options);
    };

    return newRunnable;
  };
}
