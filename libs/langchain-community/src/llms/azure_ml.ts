import { BaseLLMParams, LLM } from "@langchain/core/language_models/llms";
import { getEnvironmentVariable } from "@langchain/core/utils/env";

export class AzureMLHttpClient {
  endpointUrl: string;

  endpointApiKey: string;

  deploymentName?: string;

  constructor(
    endpointUrl: string,
    endpointApiKey: string,
    deploymentName?: string
  ) {
    this.deploymentName = deploymentName;
    this.endpointApiKey = endpointApiKey;
    this.endpointUrl = endpointUrl;
  }

  /**
   * Calls the AzureML endpoint. It takes a request payload as input and
   * returns a Promise that resolves to the response payload.
   * @param requestPayload The request payload for the AzureML endpoint.
   * @returns A Promise that resolves to the response payload.
   */
  async call(requestPayload: string): Promise<string> {
    const response = await fetch(this.endpointUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.endpointApiKey}`,
      },
      body: requestPayload,
    });
    if (!response.ok) {
      const error = new Error(
        `Azure ML LLM call failed with status code ${response.status}`
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (error as any).response = response;
      throw error;
    }
    return response.text();
  }
}

export interface ContentFormatter {
  /**
   * Formats the request payload for the AzureML endpoint. It takes a
   * prompt and a dictionary of model arguments as input and returns a
   * string representing the formatted request payload.
   * @param prompt The prompt for the AzureML model.
   * @param modelArgs A dictionary of model arguments.
   * @returns A string representing the formatted request payload.
   */
  formatRequestPayload: (
    prompt: string,
    modelArgs: Record<string, unknown>
  ) => string;
  /**
   * Formats the response payload from the AzureML endpoint. It takes a
   * response payload as input and returns a string representing the
   * formatted response.
   * @param responsePayload The response payload from the AzureML endpoint.
   * @returns A string representing the formatted response.
   */
  formatResponsePayload: (output: string) => string;
}

export class GPT2ContentFormatter implements ContentFormatter {
  formatRequestPayload(
    prompt: string,
    modelArgs: Record<string, unknown>
  ): string {
    return JSON.stringify({
      inputs: {
        input_string: [prompt],
      },
      parameters: modelArgs,
    });
  }

  formatResponsePayload(output: string): string {
    return JSON.parse(output)[0]["0"];
  }
}

export class HFContentFormatter implements ContentFormatter {
  formatRequestPayload(
    prompt: string,
    modelArgs: Record<string, unknown>
  ): string {
    return JSON.stringify({
      inputs: [prompt],
      parameters: modelArgs,
    });
  }

  formatResponsePayload(output: string): string {
    return JSON.parse(output)[0].generated_text;
  }
}

export class DollyContentFormatter implements ContentFormatter {
  formatRequestPayload(
    prompt: string,
    modelArgs: Record<string, unknown>
  ): string {
    return JSON.stringify({
      input_data: {
        input_string: [prompt],
      },
      parameters: modelArgs,
    });
  }

  formatResponsePayload(output: string): string {
    return JSON.parse(output)[0];
  }
}

export class LlamaContentFormatter implements ContentFormatter {
  formatRequestPayload(
    prompt: string,
    modelArgs: Record<string, unknown>
  ): string {
    return JSON.stringify({
      input_data: {
        input_string: [prompt],
      },
      parameters: modelArgs,
    });
  }

  formatResponsePayload(output: string): string {
    return JSON.parse(output)[0]["0"];
  }
}

export interface AzureMLParams extends BaseLLMParams {
  endpointUrl?: string;
  endpointApiKey?: string;
  deploymentName?: string;
  modelArgs?: Record<string, unknown>;
  contentFormatter?: ContentFormatter;
}

/**
 * Class that represents an AzureML model. It extends the LLM base class
 * and provides methods for calling the AzureML endpoint and formatting
 * the request and response payloads.
 */
export class AzureMLOnlineEndpoint extends LLM implements AzureMLParams {
  _llmType() {
    return "azure_ml";
  }

  static lc_name() {
    return "AzureMLOnlineEndpoint";
  }

  static lc_description() {
    return "A class for interacting with AzureML models.";
  }

  static lc_fields() {
    return {
      endpointUrl: {
        lc_description: "The URL of the AzureML endpoint.",
        lc_env: "AZUREML_URL",
      },
      endpointApiKey: {
        lc_description: "The API key for the AzureML endpoint.",
        lc_env: "AZUREML_API_KEY",
      },
      deploymentName: {
        lc_description: "The name of the AzureML deployment.",
      },
      contentFormatter: {
        lc_description: "The formatter for AzureML API",
      },
    };
  }

  endpointUrl: string;

  endpointApiKey: string;

  deploymentName?: string;

  contentFormatter: ContentFormatter;

  modelArgs?: Record<string, unknown>;

  httpClient: AzureMLHttpClient;

  constructor(fields: AzureMLParams) {
    super(fields ?? {});
    if (!fields?.endpointUrl && !getEnvironmentVariable("AZUREML_URL")) {
      throw new Error("No Azure ML Url found.");
    }
    if (!fields?.endpointApiKey && !getEnvironmentVariable("AZUREML_API_KEY")) {
      throw new Error("No Azure ML ApiKey found.");
    }
    if (!fields?.contentFormatter) {
      throw new Error("No Content Formatter provided.");
    }

    this.endpointUrl =
      fields.endpointUrl || `${getEnvironmentVariable("AZUREML_URL")}`;
    this.endpointApiKey =
      fields.endpointApiKey || `${getEnvironmentVariable("AZUREML_API_KEY")}`;
    this.deploymentName = fields.deploymentName;
    this.httpClient = new AzureMLHttpClient(
      this.endpointUrl,
      this.endpointApiKey,
      this.deploymentName
    );
    this.contentFormatter = fields.contentFormatter;
    this.modelArgs = fields.modelArgs;
  }

  /**
   * Calls the AzureML endpoint with the provided prompt and model arguments.
   * It returns a Promise that resolves to the generated text.
   * @param prompt The prompt for the AzureML model.
   * @param modelArgs A dictionary of model arguments.
   * @returns A Promise that resolves to the generated text.
   */
  async _call(
    prompt: string,
    modelArgs: Record<string, unknown>
  ): Promise<string> {
    const requestPayload = this.contentFormatter.formatRequestPayload(
      prompt,
      modelArgs
    );
    const responsePayload = await this.httpClient.call(requestPayload);
    return this.contentFormatter.formatResponsePayload(responsePayload);
  }
}
