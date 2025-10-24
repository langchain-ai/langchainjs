import { ChatPromptTemplate } from "@langchain/core/prompts";
import fs from "node:fs/promises";

const hotdogImage = await fs.readFile("hotdog.jpg");
// Convert the image to base64
const base64Image = hotdogImage.toString("base64");

const imageURL = "https://avatars.githubusercontent.com/u/126733545?s=200&v=4";

const multiModalPrompt = ChatPromptTemplate.fromMessages([
  ["system", "You have 20:20 vision! Describe the user's image."],
  [
    "human",
    [
      {
        type: "image_url",
        image_url: {
          url: "{imageURL}",
          detail: "high",
        },
      },
      {
        type: "image_url",
        image_url: "data:image/jpeg;base64,{base64Image}",
      },
    ],
  ],
]);

const formattedPrompt = await multiModalPrompt.invoke({
  imageURL,
  base64Image,
});

console.log(JSON.stringify(formattedPrompt, null, 2));
/**
{
  "kwargs": {
    "messages": [
      {
        "kwargs": {
          "content": "You have 20:20 vision! Describe the user's image.",
        }
      },
      {
        "kwargs": {
          "content": [
            {
              "type": "image_url",
              "image_url": {
                "url": "https://avatars.githubusercontent.com/u/126733545?s=200&v=4",
                "detail": "high"
              }
            },
            {
              "type": "image_url",
              "image_url": {
                "url": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEBLAEsAAD/4QBWRX...",
              }
            }
          ],
        }
      }
    ]
  }
}
 */
