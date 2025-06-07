import {
  AsyncCaller,
  AsyncCallerParams,
} from "@langchain/core/utils/async_caller";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { StructuredTool } from "@langchain/core/tools";
import { InferInteropZodOutput } from "@langchain/core/utils/types";
import { z } from "zod";

/**
 * An object containing configuration parameters for the ConneryService class.
 * @extends AsyncCallerParams
 */
export interface ConneryServiceParams extends AsyncCallerParams {
  runnerUrl: string;
  apiKey: string;
}

type ApiResponse<T> = {
  status: "success";
  data: T;
};

type ApiErrorResponse = {
  status: "error";
  error: {
    message: string;
  };
};

type Parameter = {
  key: string;
  title: string;
  description: string;
  type: string;
  validation?: {
    required?: boolean;
  };
};

type Action = {
  id: string;
  key: string;
  title: string;
  description: string;
  type: string;
  inputParameters: Parameter[];
  outputParameters: Parameter[];
  pluginId: string;
};

type Input = Record<string, string | undefined>;

type Output = Record<string, string>;

type RunActionResult = {
  output: Output;
  used: {
    actionId: string;
    input: Input;
  };
};

/**
 * A LangChain Tool object wrapping a Connery action.
 * ConneryAction is a structured tool that can be used only in the agents supporting structured tools.
 * @extends StructuredTool
 */
export class ConneryAction extends StructuredTool {
  name: string;

  description: string;

  schema: z.ZodObject<Record<string, z.ZodString | z.ZodOptional<z.ZodString>>>;

  /**
   * Creates a ConneryAction instance based on the provided Connery Action.
   * @param _action The Connery Action.
   * @param _service The ConneryService instance.
   * @returns A ConneryAction instance.
   */
  constructor(protected _action: Action, protected _service: ConneryService) {
    super();

    this.name = this._action.id;
    this.description =
      this._action.title +
      (this._action.description ? `: ${this._action.description}` : "");
    this.schema = this.createInputSchema();
  }

  /**
   * Runs the Connery Action with the provided input.
   * @param arg The input object expected by the action.
   * @returns A promise that resolves to a JSON string containing the output of the action.
   */
  protected _call(
    arg: InferInteropZodOutput<typeof this.schema>
  ): Promise<string> {
    return this._service.runAction(this._action.id, arg);
  }

  /**
   * Creates a Zod schema for the input object expected by the Connery action.
   * @returns A Zod schema for the input object expected by the Connery action.
   */
  protected createInputSchema(): z.ZodObject<
    Record<string, z.ZodString | z.ZodOptional<z.ZodString>>
  > {
    const dynamicInputFields: Record<
      string,
      z.ZodString | z.ZodOptional<z.ZodString>
    > = {};

    this._action.inputParameters.forEach((param) => {
      const isRequired = param.validation?.required ?? false;
      let fieldSchema: z.ZodString | z.ZodOptional<z.ZodString> = z.string();
      fieldSchema = isRequired ? fieldSchema : fieldSchema.optional();

      const fieldDescription =
        param.title + (param.description ? `: ${param.description}` : "");
      fieldSchema = fieldSchema.describe(fieldDescription);

      dynamicInputFields[param.key] = fieldSchema;
    });

    return z.object(dynamicInputFields);
  }
}

/**
 * A service for working with Connery Actions.
 */
export class ConneryService {
  protected runnerUrl: string;

  protected apiKey: string;

  protected asyncCaller: AsyncCaller;

  /**
   * Creates a ConneryService instance.
   * @param params A ConneryServiceParams object.
   * If not provided, the values are retrieved from the CONNERY_RUNNER_URL
   * and CONNERY_RUNNER_API_KEY environment variables.
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

  /**
   * Returns the list of Connery Actions wrapped as a LangChain StructuredTool objects.
   * @returns A promise that resolves to an array of ConneryAction objects.
   */
  async listActions(): Promise<ConneryAction[]> {
    const actions = await this._listActions();
    return actions.map((action) => new ConneryAction(action, this));
  }

  /**
   * Returns the specified Connery action wrapped as a LangChain StructuredTool object.
   * @param actionId The ID of the action to return.
   * @returns A promise that resolves to a ConneryAction object.
   */
  async getAction(actionId: string): Promise<ConneryAction> {
    const action = await this._getAction(actionId);
    return new ConneryAction(action, this);
  }

  /**
   * Runs the specified Connery action with the provided input.
   * @param actionId The ID of the action to run.
   * @param input The input object expected by the action.
   * @returns A promise that resolves to a JSON string containing the output of the action.
   */
  async runAction(actionId: string, input: Input = {}): Promise<string> {
    const result = await this._runAction(actionId, input);
    return JSON.stringify(result);
  }

  /**
   * Returns the list of actions available in the Connery runner.
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

  /**
   * Returns the specified action available in the Connery runner.
   * @param actionId The ID of the action to return.
   * @returns A promise that resolves to an Action object.
   * @throws An error if the action with the specified ID is not found.
   */
  protected async _getAction(actionId: string): Promise<Action> {
    const actions = await this._listActions();
    const action = actions.find((a) => a.id === actionId);
    if (!action) {
      throw new Error(
        `The action with ID "${actionId}" was not found in the list of available actions in the Connery runner.`
      );
    }
    return action;
  }

  /**
   * Runs the specified Connery action with the provided input.
   * @param actionId The ID of the action to run.
   * @param input The input object expected by the action.
   * @returns A promise that resolves to a RunActionResult object.
   */
  protected async _runAction(
    actionId: string,
    input: Input = {}
  ): Promise<Output> {
    const response = await this.asyncCaller.call(
      fetch,
      `${this.runnerUrl}/v1/actions/${actionId}/run`,
      {
        method: "POST",
        headers: this._getHeaders(),
        body: JSON.stringify({
          input,
        }),
      }
    );
    await this._handleError(response, "Failed to run action");

    const apiResponse: ApiResponse<RunActionResult> = await response.json();
    return apiResponse.data.output;
  }

  /**
   * Returns a standard set of HTTP headers to be used in API calls to the Connery runner.
   * @returns An object containing the standard set of HTTP headers.
   */
  protected _getHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      "x-api-key": this.apiKey,
    };
  }

  /**
   * Shared error handler for API calls to the Connery runner.
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
