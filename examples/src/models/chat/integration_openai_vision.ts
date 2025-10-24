import * as fs from "node:fs/promises";

import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";

const imageData = await fs.readFile("./hotdog.jpg");
const chat = new ChatOpenAI({
  model: "gpt-4-vision-preview",
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

const lowDetailImage = new HumanMessage({
  content: [
    {
      type: "text",
      text: "Summarize the contents of this image.",
    },
    {
      type: "image_url",
      image_url: {
        url: "https://blog.langchain.dev/content/images/size/w1248/format/webp/2023/10/Screenshot-2023-10-03-at-4.55.29-PM.png",
        detail: "low",
      },
    },
  ],
});
const res3 = await chat.invoke([lowDetailImage]);
console.log({ res3 });

/*
  {
    res3: AIMessage {
      content: 'The image shows a user interface for a service named "WebLangChain," which appears to be powered by "Twalv." It includes a text box with the prompt "Ask me anything about anything!" suggesting that users can enter questions on various topics. Below the text box, there are example questions that users might ask, such as "what is langchain?", "history of mesopotamia," "how to build a discord bot," "leonardo dicaprio girlfriend," "fun gift ideas for software engineers," "how does a prism separate light," and "what beer is best." The interface also includes a round blue button with a paper plane icon, presumably to submit the question. The overall theme of the image is dark with blue accents.',
      additional_kwargs: { function_call: undefined }
    }
  }
*/
