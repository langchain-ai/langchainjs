import fs from "fs";
import {
  ChatGoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@langchain/google-genai";
import { HumanMessage } from "@langchain/core/messages";

/*
 * Before running this, you should make sure you have created a
 * Google Cloud Project that has `generativelanguage` API enabled.
 *
 * You will also need to generate an API key and set
 * an environment variable GOOGLE_API_KEY
 *
 */

// Text
const model = new ChatGoogleGenerativeAI({
  modelName: "gemini-pro",
  maxOutputTokens: 2048,
  safetySettings: [
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
    },
  ],
});
const res = await model.invoke([
  [
    "human",
    "What would be a good company name for a company that makes colorful socks?",
  ],
]);
console.log(res);

/*
  AIMessage {
    content: '1. Rainbow Soles\n' +
      '2. Toe-tally Colorful\n' +
      '3. Bright Sock Creations\n' +
      '4. Hue Knew Socks\n' +
      '5. The Happy Sock Factory\n' +
      '6. Color Pop Hosiery\n' +
      '7. Sock It to Me!\n' +
      '8. Mismatched Masterpieces\n' +
      '9. Threads of Joy\n' +
      '10. Funky Feet Emporium\n' +
      '11. Colorful Threads\n' +
      '12. Sole Mates\n' +
      '13. Colorful Soles\n' +
      '14. Sock Appeal\n' +
      '15. Happy Feet Unlimited\n' +
      '16. The Sock Stop\n' +
      '17. The Sock Drawer\n' +
      '18. Sole-diers\n' +
      '19. Footloose Footwear\n' +
      '20. Step into Color',
    name: 'model',
    additional_kwargs: {}
  }
*/

// Multi-modal
const vision = new ChatGoogleGenerativeAI({
  modelName: "gemini-pro-vision",
  maxOutputTokens: 2048,
  safetySettings: [
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
    },
  ],
});
const image = fs.readFileSync("./hotdog.jpg").toString("base64");
const input2 = [
  new HumanMessage({
    content: [
      {
        type: "text",
        text: "Describe the following image.",
      },
      {
        type: "image_url",
        image_url: `data:image/png;base64,${image}`,
      },
    ],
  }),
];

const res2 = await vision.invoke(input2);

console.log(res2);

/*
  AIMessage {
    content: ' The image shows a hot dog in a bun. The hot dog is grilled and has a dark brown color. The bun is toasted and has a light brown color. The hot dog is in the center of the bun.',
    name: 'model',
    additional_kwargs: {}
  }
*/

// Multi-modal streaming
const res3 = await vision.stream(input2);

for await (const chunk of res3) {
  console.log(chunk);
}

/*
  AIMessageChunk {
    content: ' The image shows a hot dog in a bun. The hot dog is grilled and has grill marks on it. The bun is toasted and has a light golden',
    name: 'model',
    additional_kwargs: {}
  }
  AIMessageChunk {
    content: ' brown color. The hot dog is in the center of the bun.',
    name: 'model',
    additional_kwargs: {}
  }
*/
