import { ChatOllama } from "@langchain/ollama";
import { StringOutputParser } from "@langchain/core/output_parsers";

const model = new ChatOllama({
  baseUrl: "http://localhost:11434", // Default value
  model: "llama3",
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
The translation of "I love programming" into German is:

Ich liebe Programmieren.

Here's a breakdown of the translation:

* Ich = I
* liebe = love
* Programmieren = programming (note: this word is the infinitive form, which is often used in informal contexts or when speaking about one's profession or hobby)

If you want to make it sound more formal or use the correct verb conjugation for "I", you can say:

Ich bin ein großer Fan von Programmieren.

This translates to:

I am a big fan of programming.

In this sentence, "bin" is the first person singular present tense of the verb "sein", which means "to be". The phrase "ein großer Fan" means "a big fan".
*/
