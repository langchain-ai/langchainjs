import { Tool } from "./base.js";
import { DynamicTool, DynamicToolInput } from "./dynamic.js";

interface SfnConfig {
  stateMachineArn: string;
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

interface SfnClientConstructorArgs {
  region?: string;
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
  };
}

// Abstract away lc_namespace and lc_secrets into a base class
// that can be extended by all tools that need it.
abstract class AWSSfnToolConfig extends DynamicTool {
  get lc_namespace(): string[] {
    return [...super.lc_namespace, "aws_sfn"];
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      accessKeyId: "AWS_ACCESS_KEY_ID",
      secretAccessKey: "AWS_SECRET_ACCESS_KEY",
    };
  }
}

export class StartExecutionAWSSfnTool extends AWSSfnToolConfig {
  private sfnConfig: SfnConfig;

  constructor({
    name,
    description,
    ...rest
  }: SfnConfig & Omit<DynamicToolInput, "func">) {
    super({
      name,
      description,
      func: async (input: string) => this._func(input),
    });

    this.sfnConfig = rest;
  }

  /** @ignore */
  async _func(input: string): Promise<string> {
    const { Client, Invoker } = await SfnImports();
    const clientConstructorArgs: SfnClientConstructorArgs =
      getClientConstructorArgs(this.sfnConfig);
    const sfnClient = new Client(clientConstructorArgs);

    return new Promise((resolve) => {
      let payload;
      try {
        payload = JSON.parse(input);
      } catch (e) {
        console.error("Error starting state machine execution:", e);
        resolve("failed to complete request");
      }

      const command = new Invoker({
        stateMachineArn: this.sfnConfig.stateMachineArn,
        input: JSON.stringify(payload),
      });

      sfnClient
        .send(command)
        .then((response) =>
          resolve(
            response.executionArn ? response.executionArn : "request completed."
          )
        )
        .catch((error: Error) => {
          console.error("Error starting state machine execution:", error);
          resolve("failed to complete request");
        });
    });
  }
}

export class DescribeExecutionAWSSfnTool extends Tool {
  name = "describe-execution-aws-sfn";

  sfnConfig: SfnConfig;

  constructor(config: SfnConfig) {
    super(...arguments);
    this.sfnConfig = config;
  }

  /** @ignore */
  async _call(input: string) {
    const { Client, Describer } = await SfnImports();
    const clientConstructorArgs: SfnClientConstructorArgs =
      getClientConstructorArgs(this.sfnConfig);
    const sfnClient = new Client(clientConstructorArgs);

    const command = new Describer({
      executionArn: input,
    });
    return await sfnClient
      .send(command)
      .then((response) =>
        response.executionArn
          ? JSON.stringify({
              executionArn: response.executionArn,
              name: response.name,
              status: response.status,
              startDate: response.startDate,
              stopDate: response.stopDate,
              input: response.input,
              output: response.output,
              error: response.error,
              cause: response.cause,
            })
          : "{}"
      )
      .catch((error: Error) => {
        console.error("Error describing state machine execution:", error);
        return "failed to complete request";
      });
  }

  description = "This tool is useful for checking the status of a AWS Step Function execution (aka. statemachine exeuction). Input to this tool is a properly formatted AWS Step Function Execution ARN (executionArn). The output is a JSON object containing the executionArn, name, status, startDate, stopDate, input, output, error, and cause of the execution.";
}

export class SendTaskSuccessAWSSfnTool extends AWSSfnToolConfig {
  private sfnConfig: SfnConfig;

  constructor({
    name,
    description,
    ...rest
  }: SfnConfig & Omit<DynamicToolInput, "func">) {
    super({
      name,
      description,
      func: async (input: string) => this._func(input),
    });

    this.sfnConfig = rest;
  }

  /** @ignore */
  async _func(input: string): Promise<string> {
    const { Client, TaskSuccessSender } = await SfnImports();
    const clientConstructorArgs: SfnClientConstructorArgs =
      getClientConstructorArgs(this.sfnConfig);
    const sfnClient = new Client(clientConstructorArgs);

    return new Promise((resolve) => {
      let payload;
      try {
        payload = JSON.parse(input);
      } catch (e) {
        console.error("Error starting state machine execution:", e);
        resolve("failed to complete request");
      }

      const command = new TaskSuccessSender({
        taskToken: payload.taskToken,
        output: JSON.stringify(payload.output),
      });

      sfnClient
        .send(command)
        .then(() => resolve("request completed."))
        .catch((error: Error) => {
          console.error(
            "Error sending task success to state machine execution:",
            error
          );
          resolve("failed to complete request");
        });
    });
  }
}

async function SfnImports() {
  try {
    const {
      SFNClient,
      StartExecutionCommand,
      DescribeExecutionCommand,
      SendTaskSuccessCommand,
    } = await import("@aws-sdk/client-sfn");

    return {
      Client: SFNClient as typeof SFNClient,
      Invoker: StartExecutionCommand as typeof StartExecutionCommand,
      Describer: DescribeExecutionCommand as typeof DescribeExecutionCommand,
      TaskSuccessSender:
        SendTaskSuccessCommand as typeof SendTaskSuccessCommand,
    };
  } catch (e) {
    console.error(e);
    throw new Error(
      "Failed to 'load @aws-sdk/client-sfn'. Please install it eg. `yarn add @aws-sdk/client-sfn`."
    );
  }
}

function getClientConstructorArgs(config: SfnConfig) {
  const clientConstructorArgs: SfnClientConstructorArgs = {};

  if (config.region) {
    clientConstructorArgs.region = config.region;
  }

  if (config.accessKeyId && config.secretAccessKey) {
    clientConstructorArgs.credentials = {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    };
  }

  return clientConstructorArgs;
}
