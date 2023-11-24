import { OpenAI } from "langchain/llms/openai";
import {
  createAWSSfnAgent,
  AWSSfnToolkit,
} from "langchain/agents/toolkits/aws_sfn";

const _EXAMPLE_STATE_MACHINE_ASL = `
{
  "Comment": "A simple example of the Amazon States Language to define a state machine for new client onboarding.",
  "StartAt": "OnboardNewClient",
  "States": {
    "OnboardNewClient": {
      "Type": "Pass",
      "Result": "Client onboarded!",
      "End": true
    }
  }
}`;

/**
 * This example uses a deployed AWS Step Function state machine with the above Amazon State Language (ASL) definition.
 * You can test by provisioning a state machine using the above ASL within your AWS environment, or you can use a tool like LocalStack
 * to mock AWS services locally. See https://localstack.cloud/ for more information.
 */
export const run = async () => {
  const model = new OpenAI({ temperature: 0 });
  const toolkit = new AWSSfnToolkit({
    name: "onboard-new-client-workflow",
    description:
      "Onboard new client workflow. Can also be used to get status of any excuting workflow or state machine.",
    stateMachineArn:
      "arn:aws:states:us-east-1:1234567890:stateMachine:my-state-machine", // Update with your state machine ARN accordingly
    region: "<your Sfn's region>",
    accessKeyId: "<your access key id>",
    secretAccessKey: "<your secret access key>",
  });
  const executor = createAWSSfnAgent(model, toolkit);

  const input = `Onboard john doe (john@example.com) as a new client.`;

  console.log(`Executing with input "${input}"...`);

  const result = await executor.invoke({ input });

  console.log(`Got output ${result.output}`);

  console.log(
    `Got intermediate steps ${JSON.stringify(
      result.intermediateSteps,
      null,
      2
    )}`
  );
};
