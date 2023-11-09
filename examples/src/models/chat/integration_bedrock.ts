import { BedrockChat } from "langchain/chat_models/bedrock";
// Or, from web environments:
// import { BedrockChat } from "langchain/chat_models/bedrock/web";

import { HumanMessage } from "langchain/schema";

// If no credentials are provided, the default credentials from
// @aws-sdk/credential-provider-node will be used.
const model = new BedrockChat({
  model: "anthropic.claude-v2",
  region: "us-east-1",
  // endpointUrl: "custom.amazonaws.com",
  // credentials: {
  //   accessKeyId: process.env.BEDROCK_AWS_ACCESS_KEY_ID!,
  //   secretAccessKey: process.env.BEDROCK_AWS_SECRET_ACCESS_KEY!,
  // },
  // modelKwargs: {},
});

const res = await model.invoke([
  new HumanMessage({ content: "Tell me a joke" }),
]);
console.log(res);

/*
  AIMessage {
    content: " Here's a silly joke: \n" +
      '\n' +
      'What do you call a dog magician? A labracadabrador!',
    name: undefined,
    additional_kwargs: {}
  }
*/
