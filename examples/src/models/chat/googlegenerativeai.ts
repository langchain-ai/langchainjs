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
    content: '1. Sock-It-To-Me\n' +
      '2. Happy Soles\n' +
      '3. Toe-tally Colorful\n' +
      '4. Sock-O-Rama\n' +
      '5. Rainbow Feet\n' +
      '6. Colorful Soles\n' +
      '7. Hue-Man Socks\n' +
      '8. Sock Appeal\n' +
      '9. Sole-ly Colorful\n' +
      '10. Sock-cessful Stepping',
    name: 'model',
    additional_kwargs: { citationSources: undefined, filters: { safetyRatings: [Array] } }
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
    content: ' The image shows a hot dog in a bun. The hot dog is grilled and has grill marks on it. The bun is toasted and has a light golden brown color. The hot dog is in the center of the bun.',
    name: 'model',
    additional_kwargs: { citationSources: undefined, filters: { safetyRatings: [Array] } }
  }
*/
