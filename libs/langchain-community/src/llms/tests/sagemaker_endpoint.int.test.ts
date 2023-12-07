/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { expect, test } from "@jest/globals";
import {
  SageMakerEndpoint,
  SageMakerLLMContentHandler,
} from "../sagemaker_endpoint.js";

// yarn test:single /{path_to}/langchain/src/llms/tests/sagemaker.int.test.ts
describe.skip("Test SageMaker LLM", () => {
  test("without streaming", async () => {
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

    const contentHandler = new LLama213BHandler();
    const model = new SageMakerEndpoint({
      endpointName: "aws-productbot-ai-dev-llama-2-13b-chat",
      streaming: false,
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
      "hello, my name is John Doe, tell me a fun story about llamas."
    );

    expect(response.length).toBeGreaterThan(0);
  });

  test("with streaming", async () => {
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
        return new TextDecoder("utf-8").decode(output);
      }
    }

    const contentHandler = new LLama213BHandler();
    const model = new SageMakerEndpoint({
      endpointName: "aws-productbot-ai-dev-llama-2-13b-chat",
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
      "hello, my name is John Doe, tell me a fun story about llamas in 3 paragraphs"
    );

    const chunks = [];
    for await (const chunk of response) {
      chunks.push(chunk);
    }

    expect(response.length).toBeGreaterThan(0);
  });
});
