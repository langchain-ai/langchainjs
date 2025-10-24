import {
  defaultProvider,
  DefaultProviderInit,
} from "@aws-sdk/credential-provider-node";

import type { BaseChatModelParams } from "@langchain/core/language_models/chat_models";

import { BaseBedrockInput } from "../../utils/bedrock/index.js";
import { BedrockChat as BaseBedrockChat } from "./web.js";

export interface BedrockChatFields
  extends Partial<BaseBedrockInput>,
    BaseChatModelParams,
    Partial<DefaultProviderInit> {}

/**
 * AWS Bedrock chat model integration.
 *
 * Setup:
 * Install `@langchain/community` and set the following environment variables:
 *
 * ```bash
 * npm install @langchain/openai
 * export AWS_REGION="your-aws-region"
 * export AWS_SECRET_ACCESS_KEY="your-aws-secret-access-key"
 * export AWS_ACCESS_KEY_ID="your-aws-access-key-id"
 * ```
 *
 * ## [Constructor args](/classes/langchain_community_chat_models_bedrock.BedrockChat.html#constructor)
 *
 * ## [Runtime args](/interfaces/langchain_community_chat_models_bedrock_web.BedrockChatCallOptions.html)
 *
 * Runtime args can be passed as the second argument to any of the base runnable methods `.invoke`. `.stream`, `.batch`, etc.
 * They can also be passed via `.withConfig`, or the second arg in `.bindTools`, like shown in the examples below:
 *
 * ```typescript
 * // When calling `.withConfig`, call options should be passed via the first argument
 * const llmWithArgsBound = llm.withConfig({
 *   stop: ["\n"],
 *   tools: [...],
 * });
 *
 * // When calling `.bindTools`, call options should be passed via the second argument
 * const llmWithTools = llm.bindTools(
 *   [...],
 *   {
 *     stop: ["stop on this token!"],
 *   }
 * );
 * ```
 *
 * ## Examples
 *
 * <details open>
 * <summary><strong>Instantiate</strong></summary>
 *
 * ```typescript
 * import { BedrockChat } from '@langchain/community/chat_models/bedrock';
 *
 * const llm = new BedrockChat({
 *   region: process.env.BEDROCK_AWS_REGION,
 *   maxRetries: 0,
 *   model: "anthropic.claude-3-5-sonnet-20240620-v1:0",
 *   temperature: 0,
 *   maxTokens: undefined,
 *   // other params...
 * });
 *
 * // You can also pass credentials in explicitly:
 * const llmWithCredentials = new BedrockChat({
 *   region: process.env.BEDROCK_AWS_REGION,
 *   model: "anthropic.claude-3-5-sonnet-20240620-v1:0",
 *   credentials: {
 *     secretAccessKey: process.env.BEDROCK_AWS_SECRET_ACCESS_KEY!,
 *     accessKeyId: process.env.BEDROCK_AWS_ACCESS_KEY_ID!,
 *   },
 * });
 * ```
 * </details>
 *
 * <br />
 *
 * <details>
 * <summary><strong>Invoking</strong></summary>
 *
 * ```typescript
 * const messages = [
 *   {
 *     type: "system" as const,
 *     content: "You are a helpful translator. Translate the user sentence to French.",
 *   },
 *   {
 *     type: "human" as const,
 *     content: "I love programming.",
 *   },
 * ];
 * const result = await llm.invoke(messages);
 * console.log(result);
 * ```
 *
 * ```txt
 * AIMessage {
 *   "content": "Here's the translation to French:\n\nJ'adore la programmation.",
 *   "additional_kwargs": {
 *     "id": "msg_bdrk_01HCZHa2mKbMZeTeHjLDd286"
 *   },
 *   "response_metadata": {
 *     "type": "message",
 *     "role": "assistant",
 *     "model": "claude-3-5-sonnet-20240620",
 *     "stop_reason": "end_turn",
 *     "stop_sequence": null,
 *     "usage": {
 *       "input_tokens": 25,
 *       "output_tokens": 19
 *     }
 *   },
 *   "tool_calls": [],
 *   "invalid_tool_calls": []
 * }
 * ```
 * </details>
 *
 * <br />
 *
 * <details>
 * <summary><strong>Streaming Chunks</strong></summary>
 *
 * ```typescript
 * for await (const chunk of await llm.stream(messages)) {
 *   console.log(chunk);
 * }
 * ```
 *
 * ```txt
 * AIMessageChunk {
 *   "content": "",
 *   "additional_kwargs": {
 *     "id": "msg_bdrk_01RhFuGR9uJ2bj5GbdAma4y6"
 *   },
 *   "response_metadata": {
 *     "type": "message",
 *     "role": "assistant",
 *     "model": "claude-3-5-sonnet-20240620",
 *     "stop_reason": null,
 *     "stop_sequence": null
 *   },
 * }
 * AIMessageChunk {
 *   "content": "J",
 * }
 * AIMessageChunk {
 *   "content": "'adore la",
 * }
 * AIMessageChunk {
 *   "content": " programmation.",
 * }
 * AIMessageChunk {
 *   "content": "",
 *   "additional_kwargs": {
 *     "stop_reason": "end_turn",
 *     "stop_sequence": null
 *   },
 * }
 * AIMessageChunk {
 *   "content": "",
 *   "response_metadata": {
 *     "amazon-bedrock-invocationMetrics": {
 *       "inputTokenCount": 25,
 *       "outputTokenCount": 11,
 *       "invocationLatency": 659,
 *       "firstByteLatency": 506
 *     }
 *   },
 *   "usage_metadata": {
 *     "input_tokens": 25,
 *     "output_tokens": 11,
 *     "total_tokens": 36
 *   }
 * }
 * ```
 * </details>
 *
 * <br />
 *
 * <details>
 * <summary><strong>Aggregate Streamed Chunks</strong></summary>
 *
 * ```typescript
 * import { AIMessageChunk } from '@langchain/core/messages';
 * import { concat } from '@langchain/core/utils/stream';
 *
 * const stream = await llm.stream(messages);
 * let full: AIMessageChunk | undefined;
 * for await (const chunk of stream) {
 *   full = !full ? chunk : concat(full, chunk);
 * }
 * console.log(full);
 * ```
 *
 * ```txt
 * AIMessageChunk {
 *   "content": "J'adore la programmation.",
 *   "additional_kwargs": {
 *     "id": "msg_bdrk_017b6PuBybA51P5LZ9K6gZHm",
 *     "stop_reason": "end_turn",
 *     "stop_sequence": null
 *   },
 *   "response_metadata": {
 *     "type": "message",
 *     "role": "assistant",
 *     "model": "claude-3-5-sonnet-20240620",
 *     "stop_reason": null,
 *     "stop_sequence": null,
 *     "amazon-bedrock-invocationMetrics": {
 *       "inputTokenCount": 25,
 *       "outputTokenCount": 11,
 *       "invocationLatency": 1181,
 *       "firstByteLatency": 1177
 *     }
 *   },
 *   "usage_metadata": {
 *     "input_tokens": 25,
 *     "output_tokens": 11,
 *     "total_tokens": 36
 *   }
 * }
 * ```
 * </details>
 *
 * <br />
 *
 * <details>
 * <summary><strong>Bind tools</strong></summary>
 *
 * ```typescript
 * import { z } from 'zod';
 * import { AIMessage } from '@langchain/core/messages';
 *
 * const GetWeather = {
 *   name: "GetWeather",
 *   description: "Get the current weather in a given location",
 *   schema: z.object({
 *     location: z.string().describe("The city and state, e.g. San Francisco, CA")
 *   }),
 * }
 *
 * const GetPopulation = {
 *   name: "GetPopulation",
 *   description: "Get the current population in a given location",
 *   schema: z.object({
 *     location: z.string().describe("The city and state, e.g. San Francisco, CA")
 *   }),
 * }
 *
 * const llmWithTools = llm.bindTools([GetWeather, GetPopulation]);
 * const aiMsg: AIMessage = await llmWithTools.invoke(
 *   "Which city is hotter today and which is bigger: LA or NY?"
 * );
 * console.log(aiMsg.tool_calls);
 * ```
 *
 * ```txt
 * [
 *   {
 *     name: 'GetWeather',
 *     args: { location: 'Los Angeles, CA' },
 *     id: 'toolu_bdrk_01R2daqwHR931r4baVNzbe38',
 *     type: 'tool_call'
 *   },
 *   {
 *     name: 'GetWeather',
 *     args: { location: 'New York, NY' },
 *     id: 'toolu_bdrk_01WDadwNc7PGqVZvCN7Dr7eD',
 *     type: 'tool_call'
 *   },
 *   {
 *     name: 'GetPopulation',
 *     args: { location: 'Los Angeles, CA' },
 *     id: 'toolu_bdrk_014b8zLkpAgpxrPfewKinJFc',
 *     type: 'tool_call'
 *   },
 *   {
 *     name: 'GetPopulation',
 *     args: { location: 'New York, NY' },
 *     id: 'toolu_bdrk_01Tt8K2MUP15kNuMDFCLEFKN',
 *     type: 'tool_call'
 *   }
 * ]
 * ```
 * </details>
 *
 * <br />
 *
 * <details>
 * <summary><strong>Structured Output</strong></summary>
 *
 * ```typescript
 * const Joke = z.object({
 *   setup: z.string().describe("The setup of the joke"),
 *   punchline: z.string().describe("The punchline to the joke"),
 *   rating: z.number().optional().describe("How funny the joke is, from 1 to 10")
 * }).describe('Joke to tell user.');
 *
 * const structuredLlm = llm.withStructuredOutput(Joke);
 * const jokeResult = await structuredLlm.invoke("Tell me a joke about cats");
 * console.log(jokeResult);
 * ```
 *
 * ```txt
 * {
 *   setup: "Why don't cats play poker in the jungle?",
 *   punchline: 'Too many cheetahs!'
 * }
 * ```
 * </details>
 *
 * <br />
 *
 * <details>
 * <summary><strong>Response Metadata</strong></summary>
 *
 * ```typescript
 * const aiMsgForResponseMetadata = await llm.invoke(messages);
 * console.log(aiMsgForResponseMetadata.response_metadata);
 * ```
 *
 * ```txt
 * "response_metadata": {
 *   "type": "message",
 *   "role": "assistant",
 *   "model": "claude-3-5-sonnet-20240620",
 *   "stop_reason": "end_turn",
 *   "stop_sequence": null,
 *   "usage": {
 *     "input_tokens": 25,
 *     "output_tokens": 19
 *   }
 * }
 * ```
 * </details>
 */
export class BedrockChat extends BaseBedrockChat {
  static lc_name() {
    return "BedrockChat";
  }

  constructor(fields?: BedrockChatFields) {
    const {
      profile,
      filepath,
      configFilepath,
      ignoreCache,
      mfaCodeProvider,
      roleAssumer,
      roleArn,
      webIdentityTokenFile,
      roleAssumerWithWebIdentity,
      ...rest
    } = fields ?? {};
    super({
      ...rest,
      credentials:
        rest?.credentials ??
        defaultProvider({
          profile,
          filepath,
          configFilepath,
          ignoreCache,
          mfaCodeProvider,
          roleAssumer,
          roleArn,
          webIdentityTokenFile,
          roleAssumerWithWebIdentity,
        }),
    });
  }
}

export {
  convertMessagesToPromptAnthropic,
  convertMessagesToPrompt,
} from "./web.js";

/**
 * @deprecated Use `BedrockChat` instead.
 */
export const ChatBedrock = BedrockChat;
