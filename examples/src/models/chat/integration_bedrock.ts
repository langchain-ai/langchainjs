import { BedrockChat } from "@langchain/community/chat_models/bedrock";
// Or, from web environments:
// import { BedrockChat } from "@langchain/community/chat_models/bedrock/web";
import { HumanMessage } from "@langchain/core/messages";

// If no credentials are provided, the default credentials from
// @aws-sdk/credential-provider-node will be used.

// modelKwargs are additional parameters passed to the model when it
// is invoked.
const model = new BedrockChat({
  model: "anthropic.claude-3-sonnet-20240229-v1:0",
  region: "us-east-1",
  // endpointUrl: "custom.amazonaws.com",
  // credentials: {
  //   accessKeyId: process.env.BEDROCK_AWS_ACCESS_KEY_ID!,
  //   secretAccessKey: process.env.BEDROCK_AWS_SECRET_ACCESS_KEY!,
  // },
  // modelKwargs: {
  //   anthropic_version: "bedrock-2023-05-31",
  // },
});

// Other model names include:
// "mistral.mistral-7b-instruct-v0:2"
// "mistral.mixtral-8x7b-instruct-v0:1"
//
// For a full list, see the Bedrock page in AWS.

const res = await model.invoke([
  new HumanMessage({ content: "Tell me a joke" }),
]);
console.log(res);

/*
  AIMessage {
    content: "Here's a silly joke for you:\n" +
      '\n' +
      "Why can't a bicycle stand up by itself?\n" +
      "Because it's two-tired!",
    name: undefined,
    additional_kwargs: { id: 'msg_01NYN7Rf39k4cgurqpZWYyDh' }
  }
*/

const stream = await model.stream([
  new HumanMessage({ content: "Tell me a joke" }),
]);

for await (const chunk of stream) {
  console.log(chunk.content);
}

/*
  Here
  's
  a
  silly
  joke
  for
  you
  :


  Why
  can
  't
  a
  bicycle
  stand
  up
  by
  itself
  ?

  Because
  it
  's
  two
  -
  tired
  !
*/
