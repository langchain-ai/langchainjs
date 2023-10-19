import { SimpleChatModel, BaseChatModelParams } from "./base.js";
import { BaseLanguageModelCallOptions } from "../base_language/index.js";
import { BaseMessage, ChatMessage } from "../schema/index.js";
import { getEnvironmentVariable } from "../util/env.js";
import { CloudflareWorkersAIInput } from "../llms/cloudflare_workersai.js";

/**
 * An interface defining the options for a Cloudflare Workers AI call. It extends
 * the BaseLanguageModelCallOptions interface.
 */
export interface ChatCloudflareWorkersAICallOptions
  extends BaseLanguageModelCallOptions {}

/**
 * A class that enables calls to the Cloudflare Workers AI API to access large language
 * models in a chat-like fashion. It extends the SimpleChatModel class and
 * implements the CloudflareWorkersAIInput interface.
 */
export class ChatCloudflareWorkersAI
  extends SimpleChatModel
  implements CloudflareWorkersAIInput
{
  static lc_name() {
    return "ChatCloudflareWorkersAI";
  }

  lc_serializable = true;

  model = "@cf/meta/llama-2-7b-chat-int8";

  cloudflareAccountId?: string;

  cloudflareApiToken?: string;

  baseUrl: string;

  constructor(fields?: CloudflareWorkersAIInput & BaseChatModelParams) {
    super(fields ?? {});

    this.model = fields?.model ?? this.model;
    this.cloudflareAccountId =
      fields?.cloudflareAccountId ??
      getEnvironmentVariable("CLOUDFLARE_ACCOUNT_ID");
    this.cloudflareApiToken =
      fields?.cloudflareApiToken ??
      getEnvironmentVariable("CLOUDFLARE_API_TOKEN");
    this.baseUrl =
      fields?.baseUrl ??
      `https://api.cloudflare.com/client/v4/accounts/${this.cloudflareAccountId}/ai/run`;
    if (this.baseUrl.endsWith("/")) {
      this.baseUrl = this.baseUrl.slice(0, -1);
    }
  }

  _llmType() {
    return "cloudflare";
  }

  /** Get the identifying parameters for this LLM. */
  get identifyingParams() {
    return { model: this.model };
  }

  /**
   * Get the parameters used to invoke the model
   */
  invocationParams(_options?: this["ParsedCallOptions"]) {
    return {
      model: this.model,
    };
  }

  _combineLLMOutput() {
    return {};
  }

  /**
   * Method to validate the environment.
   */
  validateEnvironment() {
    if (!this.cloudflareAccountId) {
      throw new Error(
        `No Cloudflare account ID found. Please provide it when instantiating the CloudflareWorkersAI class, or set it as "CLOUDFLARE_ACCOUNT_ID" in your environment variables.`
      );
    }
    if (!this.cloudflareApiToken) {
      throw new Error(
        `No Cloudflare API key found. Please provide it when instantiating the CloudflareWorkersAI class, or set it as "CLOUDFLARE_API_KEY" in your environment variables.`
      );
    }
  }

  protected _formatMessages(
    messages: BaseMessage[]
  ): { role: string; content: string }[] {
    const formattedMessages = messages.map((message) => {
      let role;
      if (message._getType() === "human") {
        role = "user";
      } else if (message._getType() === "ai") {
        role = "assistant";
      } else if (message._getType() === "system") {
        role = "system";
      } else if (ChatMessage.isInstance(message)) {
        role = message.role;
      } else {
        console.warn(
          `Unsupported message type passed to Cloudflare: "${message._getType()}"`
        );
        role = "user";
      }
      return {
        role,
        content: message.content,
      };
    });
    return formattedMessages;
  }

  /** @ignore */
  async _call(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"]
  ): Promise<string> {
    this.validateEnvironment();

    const url = `${this.baseUrl}/${this.model}`;
    const headers = {
      Authorization: `Bearer ${this.cloudflareApiToken}`,
      "Content-Type": "application/json",
    };

    const formattedMessages = this._formatMessages(messages);

    const data = { messages: formattedMessages };
    const responseData = await this.caller.call(async () => {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(data),
        signal: options.signal,
      });
      if (!response.ok) {
        const error = new Error(
          `Cloudflare LLM call failed with status code ${response.status}`
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (error as any).response = response;
        throw error;
      }
      return response.json();
    });

    return responseData.result.response;
  }
}
