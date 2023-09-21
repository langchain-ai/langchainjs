import { BaseChatModel, BaseChatModelParams } from "../../chat_models/base.js";
import {
  BaseMessage,
  ChatMessage,
  ChatResult,
  ChatGeneration,
} from "../../schema/index.js";

export interface BittensorInput extends BaseChatModelParams {
  systemPrompt?: string | null | undefined;
}
interface Message {
  role: string;
  content: string;
}

interface ChatPayload {
  uids?: string[];
  top_n?: number;
  messages: Message[];
}

interface APIKeyResponse {
  api_key: string;
}

interface ChatResponse {
  choices?: { message: Message }[];
}
/**
 * Class representing the Neural Internet chat model powerd by Bittensor, a decentralized network
 * full of different AI models.s
 * To analyze API_KEYS and logs of you usage visit
 *      https://api.neuralinternet.ai/api-keys
 *      https://api.neuralinternet.ai/logs
 */
export class NIBittensorChatModel
  extends BaseChatModel
  implements BittensorInput
{
  static lc_name(): string {
    return "NIBittensorLLM";
  }

  systemPrompt: string;

  constructor(fields?: BittensorInput) {
    super(fields ?? {});
    this.systemPrompt =
      fields?.systemPrompt ??
      "You are an assistant which is created by Neural Internet(NI) in decentralized network named as a Bittensor. Your task is to provide accurate response based on user prompt";
  }

  _combineLLMOutput() {
    return [];
  }

  _llmType(): string {
    return "NIBittensorLLM";
  }

  messageToOpenAIRole(message: BaseMessage) {
    const type = message._getType();
    switch (type) {
      case "system":
        return "system";
      case "ai":
        return "assistant";
      case "human":
        return "user";
      default:
        return "user";
    }
  }

  stringToChatMessage(message: string): BaseMessage {
    return new ChatMessage(message, "assistant");
  }

  /** Call out to NIBittensorChatModel's complete endpoint.
   Args:
       messages: The messages to pass into the model.

       Returns: The chat response by the model.

   Example:
    const chat = new NIBittensorChatModel();
    const message = new HumanMessage('What is bittensor?');
    const res = await chat.call([message]);
   */
  async _generate(messages: BaseMessage[]): Promise<ChatResult> {
    const processed_messages = messages.map((message) => ({
      role: this.messageToOpenAIRole(message),
      content: message.content,
    }));
    const generations: ChatGeneration[] = [];

    try {
      // Retrieve API KEY
      const apiKeyResponse: Response = await fetch(
        "https://test.neuralinternet.ai/admin/api-keys/"
      );
      if (!apiKeyResponse.ok) {
        throw new Error("Network response was not ok");
      }
      const apiKeysData: APIKeyResponse[] = await apiKeyResponse.json();
      const apiKey: string = apiKeysData[0].api_key;

      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "Endpoint-Version": "2023-05-19",
      };

      const minerResponse: Response = await fetch(
        "https://test.neuralinternet.ai/top_miner_uids",
        { headers }
      );
      if (!minerResponse.ok) {
        throw new Error("Network response was not ok");
      }
      const uids: string[] = await minerResponse.json();

      if (Array.isArray(uids) && uids.length) {
        for (const uid of uids) {
          try {
            const payload: ChatPayload = {
              uids: [uid],
              messages: [
                { role: "system", content: this.systemPrompt },
                ...processed_messages,
              ],
            };

            const response: Response = await fetch(
              "https://test.neuralinternet.ai/chat",
              {
                method: "POST",
                headers,
                body: JSON.stringify(payload),
              }
            );

            if (!response.ok) {
              throw new Error("Network response was not ok");
            }

            const chatData: ChatResponse = await response.json();

            if (chatData.choices) {
              const generation: ChatGeneration = {
                text: chatData.choices[0].message.content,
                message: this.stringToChatMessage(
                  chatData.choices[0].message.content
                ),
              };
              generations.push(generation);
              return { generations, llmOutput: {} };
            }
          } catch (error) {
            continue;
          }
        }
      }
    } catch (error) {
      const generation: ChatGeneration = {
        text: "Sorry I am unable to provide response now, Please try again later.",
        message: this.stringToChatMessage(
          "Sorry I am unable to provide response now, Please try again later."
        ),
      };
      generations.push(generation);
      return { generations, llmOutput: {} };
    }
    const generation: ChatGeneration = {
      text: "Sorry I am unable to provide response now, Please try again later.",
      message: this.stringToChatMessage(
        "Sorry I am unable to provide response now, Please try again later."
      ),
    };
    generations.push(generation);
    return { generations, llmOutput: {} };
  }

  identifyingParams(): {
    systemPrompt: string | null | undefined;
  } {
    return {
      systemPrompt: this.systemPrompt,
    };
  }
}
