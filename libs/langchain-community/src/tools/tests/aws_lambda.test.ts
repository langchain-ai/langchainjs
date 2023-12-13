import { test, jest, expect } from "@jest/globals";
import LambdaClient from "@aws-sdk/client-lambda";

import { AWSLambda } from "../aws_lambda.js";

jest.mock("@aws-sdk/client-lambda", () => ({
  LambdaClient: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockImplementation(() =>
      Promise.resolve({
        Payload: new TextEncoder().encode(
          JSON.stringify({ body: "email sent." })
        ),
      })
    ),
  })),
  InvokeCommand: jest.fn().mockImplementation(() => ({})),
}));

test("AWSLambda invokes the correct lambda function and returns the response.body contents", async () => {
  if (!LambdaClient) {
    // this is to avoid a linting error. S3Client is mocked above.
  }

  const lambda = new AWSLambda({
    name: "email-sender",
    description:
      "Sends an email with the specified content to holtkam2@gmail.com",
    region: "us-east-1",
    accessKeyId: "abc123",
    secretAccessKey: "xyz456/1T+PzUZ2fd",
    functionName: "testFunction1",
  });

  const result = await lambda.call("Hello world! This is an email.");

  expect(result).toBe("email sent.");
});
