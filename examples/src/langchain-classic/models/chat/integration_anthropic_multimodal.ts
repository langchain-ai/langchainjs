import * as fs from "node:fs/promises";

import { ChatAnthropic } from "@langchain/anthropic";
import { HumanMessage } from "@langchain/core/messages";

const imageData = await fs.readFile("./hotdog.jpg");
const chat = new ChatAnthropic({
  model: "claude-3-sonnet-20240229",
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
      content: 'The image shows a hot dog or frankfurter. It has a reddish-pink sausage filling encased in a light brown bun or bread roll. The hot dog is cut lengthwise, revealing the bright red sausage interior contrasted against the lightly toasted bread exterior. This classic fast food item is depicted in detail against a plain white background.',
      name: undefined,
      additional_kwargs: {
        id: 'msg_0153boCaPL54QDEMQExkVur6',
        type: 'message',
        role: 'assistant',
        model: 'claude-3-sonnet-20240229',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: [Object]
      }
    }
  }
*/
