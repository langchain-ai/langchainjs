import type { BaseLanguageModel } from "@langchain/core/language_models/base";
import { Tool } from "@langchain/core/tools";
import {
  SfnConfig,
  StartExecutionAWSSfnTool,
  DescribeExecutionAWSSfnTool,
  SendTaskSuccessAWSSfnTool,
} from "../../tools/aws_sfn.js";
import { Toolkit } from "./base.js";

/**
 * Interface for the arguments required to create an AWS Step Functions
 * toolkit.
 */
export interface AWSSfnToolkitArgs {
  name: string;
  description: string;
  stateMachineArn: string;
  asl?: string;
  llm?: BaseLanguageModel;
}

/**
 * Class representing a toolkit for interacting with AWS Step Functions.
 * It initializes the AWS Step Functions tools and provides them as tools
 * for the agent.
 * @example
 * ```typescript
 *
 * const toolkit = new AWSSfnToolkit({
 *   name: "onboard-new-client-workflow",
 *   description:
 *     "Onboard new client workflow. Can also be used to get status of any executing workflow or state machine.",
 *   stateMachineArn:
 *     "arn:aws:states:us-east-1:1234567890:stateMachine:my-state-machine",
 *   region: "<your Sfn's region>",
 *   accessKeyId: "<your access key id>",
 *   secretAccessKey: "<your secret access key>",
 * });
 *
 *
 * const result = await toolkit.invoke({
 *   input: "Onboard john doe (john@example.com) as a new client.",
 * });
 *
 * ```
 */
export class AWSSfnToolkit extends Toolkit {
  tools: Tool[];

  stateMachineArn: string;

  asl: string;

  constructor(args: AWSSfnToolkitArgs & SfnConfig) {
    super();
    this.stateMachineArn = args.stateMachineArn;
    if (args.asl) {
      this.asl = args.asl;
    }
    this.tools = [
      new StartExecutionAWSSfnTool({
        name: args.name,
        description: StartExecutionAWSSfnTool.formatDescription(
          args.name,
          args.description
        ),
        stateMachineArn: args.stateMachineArn,
      }),
      new DescribeExecutionAWSSfnTool(
        Object.assign(
          args.region ? { region: args.region } : {},
          args.accessKeyId && args.secretAccessKey
            ? {
                accessKeyId: args.accessKeyId,
                secretAccessKey: args.secretAccessKey,
              }
            : {}
        )
      ),
      new SendTaskSuccessAWSSfnTool(
        Object.assign(
          args.region ? { region: args.region } : {},
          args.accessKeyId && args.secretAccessKey
            ? {
                accessKeyId: args.accessKeyId,
                secretAccessKey: args.secretAccessKey,
              }
            : {}
        )
      ),
    ];
  }
}
