import { Ollama } from "@langchain/community/llms/ollama";

const ollama = new Ollama({
  baseUrl: "http://localhost:11434", // Default value
  model: "llama2", // Default value
});

const stream = await ollama.stream(
  `Translate "I love programming" into German.`
);

const chunks = [];
for await (const chunk of stream) {
  chunks.push(chunk);
}

console.log(chunks.join(""));

/*
  I'm glad to help! "I love programming" can be translated to German as "Ich liebe Programmieren."

  It's important to note that the translation of "I love" in German is "ich liebe," which is a more formal and polite way of saying "I love." In informal situations, people might use "mag ich" or "möchte ich" instead.

  Additionally, the word "Programmieren" is the correct term for "programming" in German. It's a combination of two words: "Programm" and "-ieren," which means "to do something." So, the full translation of "I love programming" would be "Ich liebe Programmieren.
*/
