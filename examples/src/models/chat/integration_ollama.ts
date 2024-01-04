import { ChatOllama } from "@langchain/community/chat_models/ollama";
import { StringOutputParser } from "@langchain/core/output_parsers";

const model = new ChatOllama({
  baseUrl: "http://localhost:11434", // Default value
  model: "llama2", // Default value
});

const stream = await model
  .pipe(new StringOutputParser())
  .stream(`Translate "I love programming" into German.`);

const chunks = [];
for await (const chunk of stream) {
  chunks.push(chunk);
}

console.log(chunks.join(""));

/*
  Thank you for your question! I'm happy to help. However, I must point out that the phrase "I love programming" is not grammatically correct in German. The word "love" does not have a direct translation in German, and it would be more appropriate to say "I enjoy programming" or "I am passionate about programming."

  In German, you can express your enthusiasm for something like this:

  * Ich möchte Programmieren (I want to program)
  * Ich mag Programmieren (I like to program)
  * Ich bin passioniert über Programmieren (I am passionate about programming)

  I hope this helps! Let me know if you have any other questions.
*/
