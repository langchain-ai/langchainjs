import {
  SageMakerEndpoint,
  SageMakerLLMContentHandler,
} from "langchain/llms/sagemaker_endpoint";

interface ResponseJsonInterface {
  generation: {
    content: string;
  };
}

// Custom for whatever model you'll be using
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

    const stringifiedPayload = JSON.stringify(payload);

    return new TextEncoder().encode(stringifiedPayload);
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
  endpointName: "aws-llama-2-13b-chat",
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
    region: "YOUR AWS ENDPOINT REGION",
    credentials: {
      accessKeyId: "YOUR AWS ACCESS ID",
      secretAccessKey: "YOUR AWS SECRET ACCESS KEY",
    },
  },
});

const res = await model.call(
  "Hello, my name is John Doe, tell me a joke about llamas "
);

console.log(res);

/*
  [
    {
      content: "Hello, John Doe! Here's a llama joke for you:
        Why did the llama become a gardener?
        Because it was great at llama-scaping!"
    }
  ]
 */
