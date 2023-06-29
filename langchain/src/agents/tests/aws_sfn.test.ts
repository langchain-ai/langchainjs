import { test, jest, expect } from "@jest/globals";
import SFNClient from "@aws-sdk/client-sfn";

import { StartExecutionAWSSfnTool } from "../../tools/aws_sfn.js";

jest.mock("@aws-sdk/client-sfn", () => ({
  SFNClient: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockImplementation(() =>
      Promise.resolve({
        executionArn: "<executionArn>",
      })
    ),
  })),
  StartExecutionCommand: jest.fn().mockImplementation(() => ({})),
}));

test("StartExecutionAWSSfnTool invokes the correct state machine and returns the executionArn", async () => {
  if (!SFNClient) {
    // this is to avoid a linting error. SfnClient is mocked above.
  }

  const sfn = new StartExecutionAWSSfnTool({
    name: "client-intake-workflow",
    description: `Handles onboarding a new client by starting the intake process after collecting client's basic information like name and email address.
      Make sure that the stateMachineArn is valid and correpsonds to the state machine you want to invoke.
      
      Example input: '{"name": "John Doe", "email":"jonh@example.com"}'
      The "name" key is optional.`,
    region: "us-east-1",
    accessKeyId: "abc123",
    secretAccessKey: "xyz456/1T+PzUZ2fd",
    stateMachineArn: "arn:aws:states:us-east-1:123456789012:stateMachine:client-intake-workflow",
  });

  const result = await sfn.call('{"email":"jonh@example.com"}');

  expect(result).toBe("<executionArn>");
});
