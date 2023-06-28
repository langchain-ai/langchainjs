import { test, jest, expect } from "@jest/globals";
import SfnClient from "@aws-sdk/client-sfn";

import { StartExecutionAWSSfnTool } from "../../tools/aws_lambda.js";

jest.mock("@aws-sdk/client-sfn", () => ({
  SfnClient: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockImplementation(() =>
      Promise.resolve({
        Payload: JSON.stringify({ email: "john@example.com" }),
      })
    ),
  })),
  InvokeCommand: jest.fn().mockImplementation(() => ({})),
}));

test("StartExecutionAWSSfnTool invokes the correct state machine function and returns the response.body contents", async () => {
  if (!SfnClient) {
    // this is to avoid a linting error. SfnClient is mocked above.
  }

  const sfn = new StartExecutionAWSSfnTool({
    name: "client-intake-workflow",
    description:
      "Handles onboarding a new client by starting the intake process after collecting their email address.",
    region: "us-east-1",
    accessKeyId: "abc123",
    secretAccessKey: "xyz456/1T+PzUZ2fd",
    stateMachineArn: "arn:aws:states:us-east-1:123456789012:stateMachine:client-intake-workflow",
  });

  const result = await sfn.call('{"email":"jonh@example.com"}');

  expect(result).toBeInstanceOf(String);
});
