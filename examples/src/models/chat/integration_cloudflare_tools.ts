import { ChatCloudflareWorkersAI } from "@langchain/cloudflare";
import {
  AIMessageChunk,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const model = new ChatCloudflareWorkersAI({
  model: "@hf/nousresearch/hermes-2-pro-mistral-7b",
  cloudflareAccountId: process.env.CLOUDFLARE_ACCOUNT_ID,
  cloudflareApiToken: process.env.CLOUDFLARE_API_TOKEN,
  // Pass a custom base URL to use Cloudflare AI Gateway
  // baseUrl: `https://gateway.ai.cloudflare.com/v1/{YOUR_ACCOUNT_ID}/{GATEWAY_NAME}/workers-ai/`,
});

const weatherSchema = z.object({
  location: z.string().describe("The location to get the weather for"),
});
const weatherTool = tool<typeof weatherSchema>(
  (input) => {
    return `The weather in ${input.location} is sunny.`;
  },
  {
    name: "get_weather",
    description: "Get the weather",
  }
);

const modelWithTools = model.bindTools([weatherTool]);

const inputMessages = [
  new SystemMessage("You are a helpful assistant."),
  new HumanMessage("What's the weather like in the North Pole?"),
];

const response = await modelWithTools.invoke(inputMessages);

console.log(response.tool_calls);

/*
[ { name: 'get_weather', args: { input: 'North Pole' } } ]
*/

const stream = await modelWithTools.stream(inputMessages);

let finalChunk: AIMessageChunk | undefined;
for await (const chunk of stream) {
  console.log("chunk: ", chunk.content);
  if (!finalChunk) {
    finalChunk = chunk;
  } else {
    finalChunk = finalChunk.concat(chunk);
  }
}

/*
chunk:  <
chunk:  tool
chunk:  _
chunk:  call
chunk:  >
chunk:  \n
chunk:  {'
chunk:  arguments
chunk:  ':
chunk:   {'
chunk:  input
chunk:  ':
chunk:   '
chunk:  N
chunk:  orth
chunk:   P
chunk:  ole
chunk:  '},
chunk:   '
chunk:  name
chunk:  ':
chunk:   '
chunk:  get
chunk:  _
chunk:  we
chunk:  ather
chunk:  '}
chunk:  \n
chunk:  </
chunk:  tool
chunk:  _
chunk:  call
chunk:  >
chunk:  <|im_end|>
*/

console.log(finalChunk?.tool_calls);

/*
[
  { name: 'get_weather', args: { input: 'North Pole' }, id: undefined }
]
*/