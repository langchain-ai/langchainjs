import {
  SFNClient as Client,
  StartExecutionCommand as Invoker,
  DescribeExecutionCommand as Describer,
  SendTaskSuccessCommand as TaskSuccessSender,
} from "@aws-sdk/client-sfn";

import { Tool, ToolParams } from "./base.js";

export interface SfnConfig {
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

export class StartExecutionAWSSfnTool extends Tool {
  private sfnConfig: SfnConfig;

  public name: string;

  public description: string;

  constructor({
    name,
    description,
    ...rest
  }: SfnConfig & { name: string; description: string }) {
    super();
    this.name = name;
    this.description = description;
    this.sfnConfig = rest;
  }

  static formatDescription(name: string, description: string): string {
    return `Use to start executing the ${name} state machine. Use to run ${name} workflows. Whenever you need to start (or execute) an asynchronous workflow (or state machine) about ${description} you should ALWAYS use this. Input should be a valid JSON string.`;
  }

  /** @ignore */
  async _call(input: string): Promise<string> {
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

  description =
    "This tool should ALWAYS be used for checking the status of any AWS Step Function execution (aka. state machine execution). Input to this tool is a properly formatted AWS Step Function Execution ARN (executionArn). The output is a stringified JSON object containing the executionArn, name, status, startDate, stopDate, input, output, error, and cause of the execution.";

  sfnConfig: Omit<SfnConfig, "stateMachineArn">;

  constructor(config: Omit<SfnConfig, "stateMachineArn"> & ToolParams) {
    super(config);
    this.sfnConfig = config;
  }

  /** @ignore */
  async _call(input: string) {
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
}

export class SendTaskSuccessAWSSfnTool extends Tool {
  name = "send-task-success-aws-sfn";

  description =
    "This tool should ALWAYS be used for sending task success to an AWS Step Function execution (aka. statemachine exeuction). Input to this tool is a stringify JSON object containing the taskToken and output.";

  sfnConfig: Omit<SfnConfig, "stateMachineArn">;

  constructor(config: Omit<SfnConfig, "stateMachineArn"> & ToolParams) {
    super(config);
    this.sfnConfig = config;
  }

  /** @ignore */
  async _call(input: string) {
    const clientConstructorArgs: SfnClientConstructorArgs =
      getClientConstructorArgs(this.sfnConfig);
    const sfnClient = new Client(clientConstructorArgs);

    let payload;
    try {
      payload = JSON.parse(input);
    } catch (e) {
      console.error("Error starting state machine execution:", e);
      return "failed to complete request";
    }

    const command = new TaskSuccessSender({
      taskToken: payload.taskToken,
      output: JSON.stringify(payload.output),
    });

    return await sfnClient
      .send(command)
      .then(() => "request completed.")
      .catch((error: Error) => {
        console.error(
          "Error sending task success to state machine execution:",
          error
        );
        return "failed to complete request";
      });
  }
}

function getClientConstructorArgs(config: Partial<SfnConfig>) {
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
