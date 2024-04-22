import { ChatFriendli } from "@langchain/community/chat_models/friendli";

const model = new ChatFriendli({
  model: "llama-2-13b-chat", // Default value
  friendliToken: process.env.FRIENDLI_TOKEN,
  friendliTeam: process.env.FRIENDLI_TEAM,
  maxTokens: 800,
  temperature: 0.9,
  topP: 0.9,
  frequencyPenalty: 0,
  stop: [],
});

const response = await model.invoke(
  "Draft a cover letter for a role in software engineering."
);

console.log(response.content);

/*
Dear [Hiring Manager],

I am excited to apply for the role of Software Engineer at [Company Name]. With my passion for innovation, creativity, and problem-solving, I am confident that I would be a valuable asset to your team.

As a highly motivated and detail-oriented individual, ...
*/

const stream = await model.stream(
  "Draft a cover letter for a role in software engineering."
);

for await (const chunk of stream) {
  console.log(chunk.content);
}

/*
D
ear
 [
H
iring
...
[
Your
 Name
]
*/
