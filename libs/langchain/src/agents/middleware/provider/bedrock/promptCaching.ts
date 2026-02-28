import { BaseMessage } from "@langchain/core/messages";
import { Runnable, RunnableConfig } from "@langchain/core/runnables";

export interface BedrockPromptCachingConfig {
  enableCaching?: boolean;
  minMessagesToCache?: number;
}

export function bedrockPromptCachingMiddleware(
  config: BedrockPromptCachingConfig = {}
) {
  const { enableCaching = true, minMessagesToCache = 2 } = config;

  return <RunInput, RunOutput>(
    runnable: Runnable<RunInput, RunOutput>
  ): Runnable<RunInput, RunOutput> => {
    if (!enableCaching) {
      return runnable;
    }

    const originalInvoke = runnable.invoke.bind(runnable);
    const newRunnable = Object.create(runnable) as Runnable<
      RunInput,
      RunOutput
    >;;

    newRunnable.invoke = async (input: RunInput, options?: RunnableConfig) => {
      let messages: BaseMessage[] = [];

      if (Array.isArray(input)) {
        messages = input as unknown as BaseMessage[];
      } else if (
        input &&
        typeof input === "object" &&
        "messages" in input &&
        Array.isArray((input as { messages: unknown }).messages)
      ) {
        messages = (input as { messages: BaseMessage[] }).messages;
      }

      if (messages.length >= minMessagesToCache) {
        // Iterate backwards to find the last cacheable message
        for (let i = messages.length - 1; i >= 0; i -= 1) {
          const message = messages[i];

          // Robust check for message type
          const msgType = message.type;
          
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
