/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { expect, test } from "@jest/globals";
import {
  SageMakerWithStream,
  SageMakerWithStreamLLMContentHandler,
} from "../sagemaker_with_stream.js";

interface ResponseJsonInterface {
  generation: {
    content: string
  }
}

class LLama213BHandler
  implements SageMakerWithStreamLLMContentHandler
{
  contentType = 'application/json'

  accepts = 'application/json'

  async transformInput(
    prompt: string,
    modelKwargs: Record<string, unknown>
  ): Promise<Uint8Array> {
    const payload = {
      inputs: [[{ role: 'user', content: prompt }]],
      parameters: modelKwargs,
    }

    const input_str = JSON.stringify(payload)

    return new TextEncoder().encode(input_str)
  }

  async transformOutput(output: Uint8Array): Promise<string> {
    const response_json = JSON.parse(
      new TextDecoder('utf-8').decode(output)
    ) as ResponseJsonInterface[]
    const content = response_json[0]?.generation.content ?? ''
    return content
  }
}

// Requires a pre-configured sagemaker endpoint
test("Test SageMakerWithStream", async () => {
  const contentHandler = new LLama213BHandler();

  const model = new SageMakerWithStream({
    endpointName: 'aws-productbot-ai-dev-llama-2-13b-chat',
    modelKwargs: {
      temperature: 0.5,
      max_new_tokens: 700,
      top_p: 0.9,
    },
    endpointKwargs: {
      CustomAttributes: 'accept_eula=true',
    },
    contentHandler,
    clientOptions: {
      region: 'us-east-1',
      credentials: {
        accessKeyId: 'AKIAQQMEQJVFGQX4OMUE',
        secretAccessKey: '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',
      },
    },
  });

  const stream = await model.call("hello, my name is ivo, tell me a joke about AI");
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
    console.log(chunks.join(""));
  }
  console.log(chunks.join(""));
  // console.log('res: ', res);

  expect(true).toBe(true);
});
