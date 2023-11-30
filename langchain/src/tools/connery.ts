import * as z from "zod";
import { AsyncCaller, AsyncCallerParams } from "../util/async_caller.js";
import { getEnvironmentVariable } from "../util/env.js";
import { StructuredTool } from "./base.js";

export interface ConneryServiceParams extends AsyncCallerParams {
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
  validation?: {
    required?: boolean;
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

export class ConneryAction extends StructuredTool {
  name: string;

  description: string;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: z.ZodObject<any, any, any, any>;

  constructor(protected _action: Action, protected _service: ConneryService) {
    super();

    this.name = this._action.title;
    this.description = this._action.description;
    this.schema = this._createInputSchema(this._action.inputParameters);
  }

  protected _call(input: Input): Promise<string> {
    return this._service.runAction(this._action.id, undefined, input);
  }

  protected _createInputSchema(
    parameters: Parameter[]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): z.ZodObject<any, any, any, any> {
    const schemaObject: Record<string, z.ZodTypeAny> = {};

    parameters.forEach((param) => {
      // Connery supports only string parameters at the moment
      const schema: z.ZodString | z.ZodOptional<z.ZodString> = param.validation
        ?.required
        ? z.string().min(1)
        : z.string().optional();
      schema.describe(param.description);
      schemaObject[param.key] = schema;
    });

    return z.object(schemaObject);
  }
}

/**
 * Class for interacting with the Connery runner API.
 */
export class ConneryService {
  protected runnerUrl: string;

  protected apiKey: string;

  protected asyncCaller: AsyncCaller;

  /**
   * Creates a ConneryService instance.
   * @param params An object containing the runnerUrl and apiKey properties.
   * If not provided, the values are retrieved from the CONNERY_RUNNER_URL
   * and CONNERY_RUNNER_API_KEY environment variables, respectively.
   * The params object extends the AsyncCallerParams interface.
   * @returns A ConneryService instance.
   */
  constructor(params?: ConneryServiceParams) {
    const runnerUrl =
      params?.runnerUrl ?? getEnvironmentVariable("CONNERY_RUNNER_URL");
    const apiKey =
      params?.apiKey ?? getEnvironmentVariable("CONNERY_RUNNER_API_KEY");

    if (!runnerUrl || !apiKey) {
      throw new Error(
        "CONNERY_RUNNER_URL and CONNERY_RUNNER_API_KEY environment variables must be set."
      );
    }

    this.runnerUrl = runnerUrl;
    this.apiKey = apiKey;

    this.asyncCaller = new AsyncCaller(params ?? {});
  }

  async listActions(): Promise<ConneryAction[]> {
    const actions = await this._listActions();
    return actions.map((action) => new ConneryAction(action, this));
  }

  async getAction(actionId: string): Promise<ConneryAction> {
    const action = await this._getAction(actionId);
    return new ConneryAction(action, this);
  }

  async runAction(
    actionId: string,
    prompt?: string,
    input?: Input
  ): Promise<string> {
    const result = await this._runAction(actionId, prompt, input);
    return JSON.stringify(result);
  }

  /**
   * Loads the list of available actions from the Connery runner.
   * @returns A promise that resolves to an array of Action objects.
   */
  protected async _listActions(): Promise<Action[]> {
    const response = await this.asyncCaller.call(
      fetch,
      `${this.runnerUrl}/v1/actions`,
      {
        method: "GET",
        headers: this._getHeaders(),
      }
    );
    await this._handleError(response, "Failed to list actions");

    const apiResponse: ApiResponse<Action[]> = await response.json();
    return apiResponse.data;
  }

  protected async _getAction(actionId: string): Promise<Action> {
    const actions = await this._listActions();
    const action = actions.find((a) => a.id === actionId);
    if (!action) {
      throw new Error(
        `The action with ID "${actionId}" was not found in the list of available actions.`
      );
    }
    return action;
  }

  /**
   * Runs the specified action with the provided input.
   * @param actionId The ID of the action to run.
   * @param prompt This is a plain English prompt with all the information needed to run the action.
   * @param input The input expected by the action.
   * The input takes precedence over the input specified in the prompt.
   * @returns A promise that resolves to a RunActionResult object.
   */
  protected async _runAction(
    actionId: string,
    prompt?: string,
    input?: Input
  ): Promise<Output> {
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
    await this._handleError(response, "Failed to run action");

    const apiResponse: ApiResponse<RunActionResult> = await response.json();
    return apiResponse.data.output;
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
   * @param errorMessage The error message to be used in the error thrown if the response is not ok.
   * @returns A promise that resolves to void.
   * @throws An error containing the error message returned by the Connery runner.
   */
  protected async _handleError(
    response: Response,
    errorMessage: string
  ): Promise<void> {
    if (response.ok) return;

    const apiErrorResponse: ApiErrorResponse = await response.json();
    throw new Error(
      `${errorMessage}. Status code: ${response.status}. Error message: ${apiErrorResponse.error.message}`
    );
  }
}
