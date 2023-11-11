import * as fs from "node:fs/promises";

import { ChatOpenAI } from "langchain/chat_models/openai";
import { HumanMessage } from "langchain/schema";

const imageData = await fs.readFile("./hotdog.jpg");
const chat = new ChatOpenAI({
  modelName: "gpt-4-vision-preview",
  maxTokens: 1024,
});
const message = new HumanMessage({
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
});

const res = await chat.invoke([message]);
console.log({ res });

/*
  {
    res: AIMessage {
      content: 'The image shows a hot dog, which consists of a grilled or steamed sausage served in the slit of a partially sliced bun. This particular hot dog appears to be plain, without any visible toppings or condiments.',
      additional_kwargs: { function_call: undefined }
    }
  }
*/

const hostedImageMessage = new HumanMessage({
  content: [
    {
      type: "text",
      text: "What does this image say?",
    },
    {
      type: "image_url",
      image_url:
        "https://www.freecodecamp.org/news/content/images/2023/05/Screenshot-2023-05-29-at-5.40.38-PM.png",
    },
  ],
});
const res2 = await chat.invoke([hostedImageMessage]);
console.log({ res2 });

/*
  {
    res2: AIMessage {
      content: 'The image contains the text "LangChain" with a graphical depiction of a parrot on the left and two interlocked rings on the left side of the text.',
      additional_kwargs: { function_call: undefined }
    }
  }
*/
