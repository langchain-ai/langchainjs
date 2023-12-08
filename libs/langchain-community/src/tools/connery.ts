import {
  AsyncCaller,
  AsyncCallerParams,
} from "@langchain/core/utils/async_caller";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { Tool } from "@langchain/core/tools";

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

type Input = {
  [key: string]: string;
};

type Output = {
  [key: string]: string;
};

type RunActionResult = {
  output: Output;
  used: {
    actionId: string;
    input: Input;
  };
};

/**
 * A LangChain Tool object wrapping a Connery action.
 * @extends Tool
 */
export class ConneryAction extends Tool {
  name: string;

  description: string;

  /**
   * Creates a ConneryAction instance based on the provided Connery action.
   * @param _action The Connery action.
   * @param _service The ConneryService instance.
   * @returns A ConneryAction instance.
   */
  constructor(protected _action: Action, protected _service: ConneryService) {
    super();

    this.name = this._action.title;
    this.description = this.getDescription();
  }

  /**
   * Runs the Connery action.
   * @param prompt This is a plain English prompt with all the information needed to run the action.
   * @returns A promise that resolves to a JSON string containing the output of the action.
   */
  protected _call(prompt: string): Promise<string> {
    return this._service.runAction(this._action.id, prompt);
  }

  /**
   * Returns the description of the Connery action.
   * @returns A string containing the description of the Connery action together with the instructions on how to use it.
   */
  protected getDescription(): string {
    const { title, description } = this._action;
    const inputParameters = this.prepareJsonForTemplate(
      this._action.inputParameters
    );
    const example1InputParametersSchema = this.prepareJsonForTemplate([
      {
        key: "recipient",
        title: "Email Recipient",
        description: "Email address of the email recipient.",
        type: "string",
        validation: {
          required: true,
        },
      },
      {
        key: "subject",
        title: "Email Subject",
        description: "Subject of the email.",
        type: "string",
        validation: {
          required: true,
        },
      },
      {
        key: "body",
        title: "Email Body",
        description: "Body of the email.",
        type: "string",
        validation: {
          required: true,
        },
      },
    ]);

    const descriptionTemplate =
      "# Instructions about tool input:\n" +
      "The input to this tool is a plain English prompt with all the input parameters needed to call it. " +
      "The input parameters schema of this tool is provided below. " +
      "Use the input parameters schema to construct the prompt for the tool. " +
      "If the input parameter is required in the schema, it must be provided in the prompt. " +
      "Do not come up with the values for the input parameters yourself. " +
      "If you do not have enough information to fill in the input parameter, ask the user to provide it. " +
      "See examples below on how to construct the prompt based on the provided tool information. " +
      "\n\n" +
      "# Instructions about tool output:\n" +
      "The output of this tool is a JSON string. " +
      "Retrieve the output parameters from the JSON string and use them in the next tool. " +
      "Do not return the JSON string as the output of the tool. " +
      "\n\n" +
      "# Example:\n" +
      "Tool information:\n" +
      "- Title: Send email\n" +
      "- Description: Send an email to a recipient.\n" +
      `- Input parameters schema in JSON fromat: ${example1InputParametersSchema}\n` +
      "The tool input prompt:\n" +
      "recipient: test@example.com, subject: 'Test email', body: 'This is a test email sent from Langchain Connery tool.'\n" +
      "\n\n" +
      "# The tool information\n" +
      `- Title: ${title}\n` +
      `- Description: ${description}\n` +
      `- Input parameters schema in JSON fromat: ${inputParameters}\n`;

    return descriptionTemplate;
  }

  /**
   * Converts the provided object to a JSON string and escapes '{' and '}' characters.
   * @param obj The object to convert to a JSON string.
   * @returns A string containing the JSON representation of the provided object with '{' and '}' characters escaped.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected prepareJsonForTemplate(obj: any): string {
    // Convert the object to a JSON string
    const jsonString = JSON.stringify(obj);

    // Replace '{' with '{{' and '}' with '}}'
    const escapedJSON = jsonString.replace(/{/g, "{{").replace(/}/g, "}}");

    return escapedJSON;
  }
}

/**
 * A service for working with Connery actions.
 *
 * Connery is an open-source plugin infrastructure for AI.
 * Source code: https://github.com/connery-io/connery-platform
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
   * Returns the list of Connery actions wrapped as a LangChain Tool objects.
   * @returns A promise that resolves to an array of ConneryAction objects.
   */
  async listActions(): Promise<ConneryAction[]> {
    const actions = await this._listActions();
    return actions.map((action) => new ConneryAction(action, this));
  }

  /**
   * Returns the specified Connery action wrapped as a LangChain Tool object.
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
   * @param prompt This is a plain English prompt with all the information needed to run the action.
   * @param input The input expected by the action.
   * If provided together with the prompt, the input takes precedence over the input specified in the prompt.
   * @returns A promise that resolves to a JSON string containing the output of the action.
   */
  async runAction(
    actionId: string,
    prompt?: string,
    input?: Input
  ): Promise<string> {
    const result = await this._runAction(actionId, prompt, input);
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
   * @param prompt This is a plain English prompt with all the information needed to run the action.
   * @param input The input object expected by the action.
   * If provided together with the prompt, the input takes precedence over the input specified in the prompt.
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
