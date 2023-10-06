/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { expect, test } from "@jest/globals";
import { SageMakerLLMContentHandler, UnifiedSageMakerEndpoint } from "../sagemaker.js";

interface ResponseJsonInterface {
  generation: {
    content: string;
  };
}

class LLama213BHandler implements SageMakerLLMContentHandler {
  contentType = "application/json";

  accepts = "application/json";

  async transformInput(
    prompt: string,
    modelKwargs: Record<string, unknown>
  ): Promise<Uint8Array> {
    const payload = {
      inputs: [[{ role: "user", content: prompt }]],
      parameters: modelKwargs,
    };
    const input_str = JSON.stringify(payload);
    return new TextEncoder().encode(input_str);
  }

  async transformOutput(output: Uint8Array): Promise<string> {
    const response_json = JSON.parse(
      new TextDecoder("utf-8").decode(output)
    ) as ResponseJsonInterface[];
    const content = response_json[0]?.generation.content ?? "";
    return content;
  }
}

// Requires a pre-configured sagemaker endpoint
test("Test UnifiedSageMakerEndpoint with streaming", async () => {
  const contentHandler = new LLama213BHandler();
  const endpointName = "aws-llama-2-13b-chat";

  const model = new UnifiedSageMakerEndpoint({
    endpointName,
    streaming: true, // specify streaming
    modelKwargs: {
      temperature: 0.5,
      max_new_tokens: 700,
      top_p: 0.9,
    },
    endpointKwargs: {
      CustomAttributes: "accept_eula=true",
    },
    contentHandler,
    clientOptions: {
      region: "us-east-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    },
  });

  const response = await model.call(
    "hello, my name is ivo, tell me a fun story about llamas in 3 paragraphs"
  );

  expect(response.length).toBeGreaterThan(0);
});