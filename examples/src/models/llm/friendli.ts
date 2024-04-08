import { Friendli } from "@langchain/community/llms/friendli";

const model = new Friendli({
  model: "mixtral-8x7b-instruct-v0-1", // Default value
  friendliToken: process.env.FRIENDLI_TOKEN,
  friendliTeam: process.env.FRIENDLI_TEAM,
  maxTokens: 18,
  temperature: 0.75,
  topP: 0.25,
  frequencyPenalty: 0,
  stop: [],
});

const response = await model.invoke(
  "Check the Grammar: She dont like to eat vegetables, but she loves fruits."
);

console.log(response);

/*
Correct: She doesn't like to eat vegetables, but she loves fruits
*/

const stream = await model.stream(
  "Check the Grammar: She dont like to eat vegetables, but she loves fruits."
);

for await (const chunk of stream) {
  console.log(chunk);
}

/*
Cor
rect
:
 She
 doesn
...
she
 loves
 fruits
*/
