import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableMap } from "@langchain/core/runnables";
import { ChatAnthropic } from "@langchain/anthropic";

const model = new ChatAnthropic({});
const jokeChain = PromptTemplate.fromTemplate(
  "Tell me a joke about {topic}"
).pipe(model);
const poemChain = PromptTemplate.fromTemplate(
  "write a 2-line poem about {topic}"
).pipe(model);

const mapChain = RunnableMap.from({
  joke: jokeChain,
  poem: poemChain,
});

const result = await mapChain.invoke({ topic: "bear" });
console.log(result);
/*
  {
    joke: AIMessage {
      content: " Here's a silly joke about a bear:\n" +
        '\n' +
        'What do you call a bear with no teeth?\n' +
        'A gummy bear!',
      additional_kwargs: {}
    },
    poem: AIMessage {
      content: ' Here is a 2-line poem about a bear:\n' +
        '\n' +
        'Furry and wild, the bear roams free  \n' +
        'Foraging the forest, strong as can be',
      additional_kwargs: {}
    }
  }
*/
