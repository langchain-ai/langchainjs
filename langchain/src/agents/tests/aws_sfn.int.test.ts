/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { test } from "@jest/globals";

import { StartExecutionAWSSfnTool } from "../../tools/aws_sfn.js";

import { OpenAI } from "../../llms/openai.js";
import { AWSSfnToolkit, createAWSSfnAgent } from "../toolkits/aws_sfn.js";

test.skip("StartExecutionAWSSfnTool invokes the correct state machine and returns the executionArn", async () => {
  const sfn = new StartExecutionAWSSfnTool({
    name: "client-intake-workflow",
    description: `Handles onboarding a new client by starting the intake process after collecting client's basic information like name and email address.
      Make sure that the stateMachineArn is valid and correpsonds to the state machine you want to invoke.

      Example input: '{"name": "John Doe", "email":"john@example.com"}'
      The "name" key is optional.`,
    region: process.env.AWS_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    stateMachineArn: process.env.AWS_SFN_ARN!,
  });

  const result = await sfn.call('{"email":"john@example.com"}');
  console.log(result);
});

test.skip("CreateAWSSfnAgent", async () => {
  const model = new OpenAI({ temperature: 0 });
  const toolkit = new AWSSfnToolkit({
    name: "onboard-new-client-workflow",
    description:
      "Onboard new client workflow. Can also be used to get status of any excuting workflow or state machine.",
    stateMachineArn: process.env.AWS_SFN_ARN!,
    region: process.env.AWS_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  });
  const executor = createAWSSfnAgent(model, toolkit);

  const input = `Onboard john doe (john@example.com) as a new client.`;

  console.log(`Executing with input "${input}"...`);

  const result = await executor.call({ input });

  console.log(`Got output ${result.output}`);

  console.log(
    `Got intermediate steps ${JSON.stringify(
      result.intermediateSteps,
      null,
      2
    )}`
  );
});
