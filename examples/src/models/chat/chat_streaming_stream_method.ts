import { ChatOpenAI } from "@langchain/openai";

const chat = new ChatOpenAI({
  model: "gpt-4o-mini",
  maxTokens: 25,
});

// Pass in a human message. Also accepts a raw string, which is automatically
// inferred to be a human message.
const stream = await chat.stream([["human", "Tell me a joke about bears."]]);

for await (const chunk of stream) {
  console.log(chunk);
}
/*
AIMessageChunk {
  content: '',
  additional_kwargs: {}
}
AIMessageChunk {
  content: 'Why',
  additional_kwargs: {}
}
AIMessageChunk {
  content: ' did',
  additional_kwargs: {}
}
AIMessageChunk {
  content: ' the',
  additional_kwargs: {}
}
AIMessageChunk {
  content: ' bear',
  additional_kwargs: {}
}
AIMessageChunk {
  content: ' bring',
  additional_kwargs: {}
}
AIMessageChunk {
  content: ' a',
  additional_kwargs: {}
}
...
*/
