import fs from "fs";
import { GoogleGenerativeAI } from "@langchain/google-genai";
import { HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
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
const model = new GoogleGenerativeAI({
  modelName: "gemini-pro",
  maxOutputTokens: 2048,
  safetySettings: [
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
    },
  ],
});
const res = await model.call(
  "What would be a good company name for a company that makes colorful socks?"
);
console.log(res);

// Multi-modal
const vision = new GoogleGenerativeAI({
  modelName: "gemini-pro-vision",
  maxOutputTokens: 2048,
  safetySettings: [
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
    },
  ],
});
const image = fs.readFileSync("./image.png").toString("base64");
const image2 = fs.readFileSync("./image2.png").toString("base64");
const input2 = [
  new HumanMessage({
    content: [
      {
        type: "image_url",
        image_url: `data:image/png;base64,${image}`,
      },
      {
        type: "image_url",
        image_url: `data:image/png;base64,${image2}`,
      },
      {
        type: "text",
        text: "Describe those pictures.",
      },
    ],
  }),
];

const tokens = await vision.countTokens(input2);
console.log("tokens", tokens);
const res2 = await vision.invoke(input2);

console.log(res2);
