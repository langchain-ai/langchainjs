import { BaseLLMParams, LLM } from "./base.js";

/**
 * Interface for the AzureML API response.
 */
interface AzureMLResponse {
  id: string;
  version: string;
  created: string;
  inputs: {
    input_string: string[];
  };
  parameters: {
    [key: string]: string;
  };
  global_parameters: {
    [key: string]: string;
  };
  output: string;
}

export interface AzureMLInput {
  endpointUrl?: string;
  endpointApiKey?: string;
  deploymentName?: string;
}

/**
 * Class that represents an AzureML model. It extends the LLM base class
 * and provides methods for calling the AzureML endpoint and formatting
 * the request and response payloads.
 */
export class AzureMLModel extends LLM implements AzureMLInput {
  _llmType() {
    return "azure_ml";
  }

  static lc_name() {
    return "AzureMLModel";
  }

  static lc_description() {
    return "A class for interacting with AzureML models.";
  }

  static lc_fields() {
    return {
      endpointUrl: {
        lc_description: "The URL of the AzureML endpoint.",
        lc_env: "AZUREML_ENDPOINT_URL",
      },
      endpointApiKey: {
        lc_description: "The API key for the AzureML endpoint.",
        lc_env: "AZUREML_ENDPOINT_API_KEY",
      },
      deploymentName: {
        lc_description: "The name of the AzureML deployment.",
        lc_env: "AZUREML_DEPLOYMENT_NAME",
      },
    };
  }

  endpointUrl: string;
  endpointApiKey: string;
  deploymentName: string;

  constructor(fields: AzureMLInput & BaseLLMParams) {
    super(fields ?? {});

    if (fields?.endpointUrl === undefined) {
      throw new Error("No Azure ML endpointUrl found.");
    }

    if (fields?.endpointApiKey === undefined) {
      throw new Error("No Azure ML endpointApiKey found.");
    }

    if (fields?.deploymentName === undefined) {
      throw new Error("No Azure ML deploymentName found.");
    }

    this.endpointUrl = fields.endpointUrl;
    this.endpointApiKey = fields.endpointApiKey;
    this.deploymentName = fields.deploymentName;
  }

  /**
   * Formats the request payload for the AzureML endpoint. It takes a
   * prompt and a dictionary of model arguments as input and returns a
   * string representing the formatted request payload.
   * @param prompt The prompt for the AzureML model.
   * @param modelArgs A dictionary of model arguments.
   * @returns A string representing the formatted request payload.
   */
  formatRequestPayload(prompt: string, modelArgs: Record<string, unknown>) {
    return JSON.stringify({
      inputs: {
        input_string: [prompt],
      },
      parameters: modelArgs,
    });
  }

  /**
   * Formats the response payload from the AzureML endpoint. It takes a
   * response payload as input and returns a string representing the
   * formatted response.
   * @param responsePayload The response payload from the AzureML endpoint.
   * @returns A string representing the formatted response.
   */
  formatResponsePayload(responsePayload: string) {
    const response = JSON.parse(responsePayload) as AzureMLResponse;
    return response.output;
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

  /**
   * Calls the AzureML endpoint with the provided prompt and model arguments.
   * It returns a Promise that resolves to the generated text.
   * @param prompt The prompt for the AzureML model.
   * @param modelArgs A dictionary of model arguments.
   * @param runManager An optional CallbackManagerForLLMRun instance.
   * @returns A Promise that resolves to the generated text.
   */
  async _call(
    prompt: string,
    modelArgs: Record<string, unknown>
  ): Promise<string> {
    const requestPayload = this.formatRequestPayload(prompt, modelArgs);
    const responsePayload = await this.call(requestPayload);
    return this.formatResponsePayload(responsePayload);
  }
}
