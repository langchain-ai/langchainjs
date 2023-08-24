import axios, { AxiosResponse } from "axios";
import { BaseLLMParams, LLM } from "./base.js";

export interface BittensorInput extends BaseLLMParams {
  systemPrompt?: string | null | undefined;
  topResponses?: number | undefined;
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
 * Class representing the Neural Internet language model powerd by Bittensor, a decentralized network
 * full of different AI models.
 * To analyze API_KEYS and logs of you usage visit
 *      https://api.neuralinternet.ai/api-keys
 *      https://api.neuralinternet.ai/logs
 */
export class NIBittensorLLM extends LLM implements BittensorInput {
  systemPrompt: string | null | undefined;

  topResponses: number | undefined;

  constructor(fields?: BittensorInput) {
    super(fields ?? {});
    this.systemPrompt = fields?.systemPrompt;
    this.topResponses = fields?.topResponses;
  }

  _llmType(): string {
    return "NIBittensorLLM";
  }

  /** Call out to NIBittensorLLM's complete endpoint.
   Args:
       prompt: The prompt to pass into the model.

       Returns:
   The string generated by the model.

   Example:
   let response = ai21._call("Tell me a joke.");
   */
  async _call(prompt: string): Promise<string> {
    const defaultPrompt =
      "You are an assistant which is created by Neural Internet(NI) in decentralized network named as a Bittensor.";

    const systemPrompt: string =
      this.systemPrompt === null || this.systemPrompt === undefined
        ? `${defaultPrompt} Your task is to provide accurate response based on user prompt`
        : `${defaultPrompt} ${this.systemPrompt}`;

    try {
      // Retrieve API KEY

      const apiKeysResponse: AxiosResponse<APIKeyResponse[]> =
        await axios.default.request<APIKeyResponse[]>({
          method: "get",
          url: "https://test.neuralinternet.ai/admin/api-keys/",
        });

      const apiKey: string = apiKeysResponse.data[0].api_key;
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "Endpoint-Version": "2023-05-19",
      };
      if (this.topResponses !== undefined) {
        this.topResponses = this.topResponses > 100 ? 100 : this.topResponses;
      } else {
        this.topResponses = 0;
      }

      const minerResponse: AxiosResponse<string[]> =
        await axios.default.request<string[]>({
          method: "get",
          url: "https://test.neuralinternet.ai/top_miner_uids",
          headers,
        });

      const uids: string[] = minerResponse.data;

      if (Array.isArray(uids) && uids.length && this.topResponses === 0) {
        for (const uid of uids) {
          try {
            const payload: ChatPayload = {
              uids: [uid],
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: prompt },
              ],
            };

            const response: AxiosResponse<ChatResponse> =
              await axios.default.request<ChatResponse>({
                method: "post",
                url: "https://test.neuralinternet.ai/chat",
                data: payload,
                headers,
              });
            if (response.data.choices) {
              return response.data.choices[0].message.content;
            }
          } catch (error) {
            continue;
          }
        }
      }

      // For top miner based on bittensor response
      if (this.topResponses === 0) {
        this.topResponses = 10;
      }
      const payload: ChatPayload = {
        top_n: this.topResponses,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
      };

      const response: AxiosResponse<ChatResponse | string> =
        await axios.default.request<ChatResponse | string>({
          method: "post",
          url: "https://test.neuralinternet.ai/chat",
          data: payload,
          headers,
        });
      if (this.topResponses) {
        return <string>response.data;
      } else if ((<ChatResponse>response.data).choices) {
        const temp: any = (<ChatResponse>response.data).choices;
        return <string>temp[0].message.content;
      }
    } catch (error) {
      return "Sorry I am unable to provide response now, Please try again later.";
    }
    return "default";
  }

  identifyingParams(): {
    systemPrompt: string | null | undefined;
    topResponses: number | undefined;
  } {
    return {
      systemPrompt: this.systemPrompt,
      topResponses: this.topResponses,
    };
  }
}
