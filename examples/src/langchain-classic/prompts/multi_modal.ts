import { HumanMessage } from "@langchain/core/messages";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import fs from "node:fs/promises";

const hotdogImage = await fs.readFile("hotdog.jpg");
const base64Image = hotdogImage.toString("base64");

const imageURL = "https://avatars.githubusercontent.com/u/126733545?s=200&v=4";

const langchainLogoMessage = new HumanMessage({
  content: [
    {
      type: "image_url",
      image_url: {
        url: "{imageURL}",
        detail: "high",
      },
    },
  ],
});
const base64ImageMessage = new HumanMessage({
  content: [
    {
      type: "image_url",
      image_url: "data:image/jpeg;base64,{base64Image}",
    },
  ],
});

const multiModalPrompt = ChatPromptTemplate.fromMessages([
  ["system", "You have 20:20 vision! Describe the user's image."],
  langchainLogoMessage,
  base64ImageMessage,
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
            }
          ],
        }
      },
      {
        "kwargs": {
          "content": [
            {
              "type": "image_url",
              "image_url": "data:image/png;base64,/9j/4AAQSkZJRgABAQEBLAEsAAD/4Q..."
            }
          ],
        }
      }
    ]
  }
}
 */
