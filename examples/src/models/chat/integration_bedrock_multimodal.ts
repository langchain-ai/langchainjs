import * as fs from "node:fs/promises";

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

const imageData = await fs.readFile("./hotdog.jpg");

const res = await model.invoke([
  new HumanMessage({
    content: [
      {
        type: "text",
        text: "What's in this image?",
      },
      {
        type: "image_url",
        image_url: {
          url: `data:image/jpeg;base64,${imageData.toString("base64")}`,
        },
      },
    ],
  }),
]);
console.log(res);

/*
  AIMessage {
    content: 'The image shows a hot dog or frankfurter. It has a reddish-pink sausage filling encased in a light brown bread-like bun. The hot dog bun is split open, revealing the sausage inside. This classic fast food item is a popular snack or meal, often served at events like baseball games or cookouts. The hot dog appears to be against a plain white background, allowing the details and textures of the food item to be clearly visible.',
    name: undefined,
    additional_kwargs: { id: 'msg_01XrLPL9vCb82U3Wrrpza18p' }
  }
*/
