import * as fs from "node:fs/promises";

import { ChatBedrockConverse } from "@langchain/aws";
import { HumanMessage } from "@langchain/core/messages";

const model = new ChatBedrockConverse({
  model: "anthropic.claude-3-sonnet-20240229-v1:0",
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.BEDROCK_AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.BEDROCK_AWS_SECRET_ACCESS_KEY!,
  },
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
  content: 'The image shows a hot dog or frankfurter. It has a reddish-pink sausage inside a light tan-colored bread bun. The hot dog bun is split open, allowing the sausage filling to be visible. The image appears to be focused solely on depicting this classic American fast food item against a plain white background.',
  response_metadata: { ... },
  id: '1608d043-575a-450e-8eac-2fef6297cfe2',
  usage_metadata: { input_tokens: 276, output_tokens: 75, total_tokens: 351 }
}
*/
