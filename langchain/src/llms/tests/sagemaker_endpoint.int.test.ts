import { test, expect } from "@jest/globals";
import {
  ContentHandlerBase,
  SagemakerEndpoint,
} from "../sagemaker_endpoint.js";

class ContentHandler implements ContentHandlerBase<string, string> {
  contentType = "application/json";

  accepts = "application/json";

  transformInput(prompt: string, modelKwargs: Record<string, unknown>) {
    const inputString = JSON.stringify({
      prompt,
      ...modelKwargs,
    });
    return Buffer.from(inputString);
  }

  transformOutput(output: Uint8Array) {
    const responseJson = JSON.parse(Buffer.from(output).toString("utf-8"));
    return responseJson[0].generated_text;
  }
}

// Test skipped because there is no public sagemaker endpoint for testing
test.skip("Test SagemakerEndpoint", async () => {
  const contentHandler = new ContentHandler();

  const model = new SagemakerEndpoint({
    endpointName: "<endpoint_name>",
    regionName: "us-east-1",
    modelKwargs: { "temperature": 1e-10},
    contentHandler,
  });

  const res = await model.call("Hello, my name is ");

  expect(typeof res).toBe("string");
});
