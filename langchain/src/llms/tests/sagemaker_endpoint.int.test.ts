/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { test, expect } from "@jest/globals";
import {
  SageMakerLLMContentHandler,
  SageMakerEndpoint,
} from "../sagemaker_endpoint.js";

class HuggingFaceTextGenerationGPT2ContentHandler
  implements SageMakerLLMContentHandler
{
  contentType = "application/json";

  accepts = "application/json";

  async transformInput(prompt: string, modelKwargs: Record<string, unknown>) {
    const inputString = JSON.stringify({
      text_inputs: prompt,
      ...modelKwargs,
    });
    return Buffer.from(inputString);
  }

  async transformOutput(output: Uint8Array) {
    const responseJson = JSON.parse(Buffer.from(output).toString("utf-8"));
    return responseJson.generated_texts[0];
  }
}

// Requires a pre-configured sagemaker endpoint
test.skip("Test SageMakerEndpoint", async () => {
  const contentHandler = new HuggingFaceTextGenerationGPT2ContentHandler();

  const model = new SageMakerEndpoint({
    endpointName:
      "jumpstart-example-huggingface-textgener-2023-05-16-22-35-45-660",
    modelKwargs: { temperature: 1e-10 },
    contentHandler,
    clientOptions: {
      region: "us-east-2",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    },
  });

  const res = await model.call("Hello, my name is ");

  expect(typeof res).toBe("string");
});
