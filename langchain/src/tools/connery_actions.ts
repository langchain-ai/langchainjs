import { AsyncCaller, AsyncCallerParams } from "../util/async_caller.js";
import { getEnvironmentVariable } from "../util/env.js";

export interface ConneryApiClientParams extends AsyncCallerParams {
  runnerUrl: string;
  apiKey: string;
}

export type ApiResponse<T> = {
  status: "success";
  data: T;
};

export type ApiErrorResponse = {
  status: "error";
  error: {
    message: string;
  };
};

export type Parameter = {
  key: string;
  title: string;
  description: string;
  type: string;
  validation: {
    required: boolean;
  };
};

export type Action = {
  id: string;
  key: string;
  title: string;
  description: string;
  type: string;
  inputParameters: Parameter[];
  outputParameters: Parameter[];
  pluginId: string;
};

export type Input = {
  [key: string]: string;
};

export type Output = {
  [key: string]: string;
};

export type RunActionResult = {
  output: Output;
  used: {
    actionId: string;
    input: Input;
  };
};

/**
 * Class for interacting with the Connery runner API.
 */
export class ConneryApiClient {
  protected runnerUrl: string;

  protected apiKey: string;

  protected asyncCaller: AsyncCaller;

  /**
   * Creates a ConneryApiClient instance.
   * @param params An object containing the runnerUrl and apiKey properties.
   * If not provided, the values are retrieved from the CONNERY_RUNNER_URL
   * and CONNERY_RUNNER_API_KEY environment variables respectively.
   * The params object extends the AsyncCallerParams interface.
   * @returns A ConneryApiClient instance.
   */
  constructor(params?: ConneryApiClientParams) {
    const runnerUrl =
      params?.runnerUrl ?? getEnvironmentVariable("CONNERY_RUNNER_URL");
    const apiKey =
      params?.apiKey ?? getEnvironmentVariable("CONNERY_RUNNER_API_KEY");

    if (!runnerUrl || !apiKey) {
      throw new Error(
        "CONNERY_RUNNER_URL and CONNERY_RUNNER_API_KEY environment variables must be set"
      );
    }

    this.runnerUrl = runnerUrl;
    this.apiKey = apiKey;

    this.asyncCaller = new AsyncCaller(params ?? {});
  }

  /**
   * Loads the list of available actions from the Connery runner.
   * @returns A promise that resolves to an array of Action objects.
   */
  async listActions(): Promise<Action[]> {
    const response = await this.asyncCaller.call(
      fetch,
      `${this.runnerUrl}/v1/actions`,
      {
        method: "GET",
        headers: this._getHeaders(),
      }
    );
    await this._handleError(response);

    const apiResponse: ApiResponse<Action[]> = await response.json();
    return apiResponse.data;
  }

  /**
   * Runs the specified action with the provided input.
   * @param actionId The ID of the action to run.
   * @param prompt This is a plain English prompt with all the information needed to run the action.
   * @param input The input expected by the action.
   * The input takes a precedence over the input specified in the prompt.
   * @returns A promise that resolves to a RunActionResult object.
   */
  async runAction(
    actionId: string,
    prompt?: string,
    input?: Input
  ): Promise<RunActionResult> {
    const response = await this.asyncCaller.call(
      fetch,
      `${this.runnerUrl}/v1/actions/${actionId}/run`,
      {
        method: "POST",
        headers: this._getHeaders(),
        body: JSON.stringify({
          prompt,
          input,
        }),
      }
    );
    await this._handleError(response);

    const apiResponse: ApiResponse<RunActionResult> = await response.json();
    return apiResponse.data;
  }

  /**
   * Returns a standard set of headers to be used in API calls to the Connery runner.
   * @returns An object containing the headers.
   */
  protected _getHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      "x-api-key": this.apiKey,
    };
  }

  /**
   * Shared error handling logic for API calls to the Connery runner.
   * If the response is not ok, an error is thrown containing the error message returned by the Connery runner.
   * Otherwise, the promise resolves to void.
   * @param response The response object returned by the Connery runner.
   * @returns A promise that resolves to void.
   * @throws An error containing the error message returned by the Connery runner.
   */
  protected async _handleError(response: Response): Promise<void> {
    if (response.ok) return;

    const apiErrorResponse: ApiErrorResponse = await response.json();
    throw new Error(
      `Failed to list Connery actions. Status code: ${response.status}. Error message: ${apiErrorResponse.error.message}`
    );
  }
}
