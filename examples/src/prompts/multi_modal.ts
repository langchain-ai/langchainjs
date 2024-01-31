import { HumanMessage } from "@langchain/core/messages";

const imageURL = "https://avatars.githubusercontent.com/u/126733545?s=200&v=4";

const langchainLogoMessage = new HumanMessage({
  content: [
    {
      type: "image_url",
      image_url: imageURL,
    },
  ],
});

console.log(JSON.stringify(langchainLogoMessage, null, 2));
/**
{
  "kwargs": {
    "content": [
      {
        "type": "image_url",
        "image_url": "https://avatars.githubusercontent.com/u/126733545?s=200&v=4"
      }
    ],
    "additional_kwargs": {}
  }
}
 */

const base64Image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAA...";

const base64ImageMessage = new HumanMessage({
  content: [
    {
      type: "image_url",
      image_url: {
        url: base64Image,
        detail: "high",
      },
    },
  ],
});

console.log(JSON.stringify(base64ImageMessage, null, 2));

/**
{
  "kwargs": {
    "content": [
      {
        "type": "image_url",
        "image_url": {
          "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAA...",
          "detail": "high"
        }
      }
    ],
    "additional_kwargs": {}
  }
}
 */
