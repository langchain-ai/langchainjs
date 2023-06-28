---
sidebar_label: Agent with AWS Lambda
hide_table_of_contents: true
---

# Agent with AWS Step Function Integration

Full docs here: https://docs.aws.amazon.com/lambda/index.html

**AWS Step Functions** is a visual workflow service that helps developers use AWS services to build distributed applications, automate processes, orchestrate microservices, and create data and machine learning (ML) pipelines.

By including a AWSSfn in the list of tools provided to an Agent, you can grant your Agent the ability to invoke async workflows running in your AWS Cloud.

When an Agent uses the AWSSfn tool, it will provide an argument of type `string`  which will in turn be passed into one of the supported actions this tool supports. The supported actions are: StartExecution, DescribeExecution, and SendTaskSuccess.

This quick start will demonstrate how an Agent could use a Step Functions state machine to kick-off an asynchronous workflow that handles client onboarding by sending an email via [Amazon Simple Email Service](https://aws.amazon.com/ses/).

### Note about credentials:

- If you have not run [`aws configure`](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-configure.html) via the AWS CLI, the `region`, `accessKeyId`, and `secretAccessKey` must be provided to the AWSLambda constructor.
- The IAM role corresponding to those credentials must have permission to invoke the lambda function.

```typescript
import { OpenAI } from "langchain/llms/openai";
import { SerpAPI } from "langchain/tools";
import { AWSLambda } from "langchain/tools/aws_lambda";
import { initializeAgentExecutorWithOptions } from "langchain/agents";

const model = new OpenAI({ temperature: 0 });
const clientIntakeTool = new AWSLambda({
  name: "client-intake-workflow",
  // tell the Agent precisely what the tool does
  description:
    "Handles onboarding a new client by starting the intake process after collecting their email address.",
  region: "us-east-1", // optional: AWS region in which the function is deployed
  accessKeyId: "abc123", // optional: access key id for a IAM user with invoke permissions
  secretAccessKey: "xyz456", // optional: secret access key for that IAM user
  stateMachineArn: "arn:aws:states:us-east-1:123456789012:stateMachine:<replace_with_statemachine_name>", // the state machine ARN as seen in AWS Console
});
const tools = [clientIntakeTool];
const executor = await initializeAgentExecutorWithOptions(tools, model, {
  agentType: "zero-shot-react-description",
});

const input = `Onboard new client John, whose email address is john@example.com.`;
const result = await executor.call({ input });
console.log(result);
```
