import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";

const chat = new ChatOpenAI({
  model: "gpt-4o-mini",
  streaming: true,
  callbacks: [
    {
      handleLLMNewToken(token: string) {
        process.stdout.write(token);
      },
    },
  ],
});

await chat.invoke([new HumanMessage("Write me a song about sparkling water.")]);
/*
Verse 1:
Bubbles rise, crisp and clear
Refreshing taste that brings us cheer
Sparkling water, so light and pure
Quenches our thirst, it's always secure

Chorus:
Sparkling water, oh how we love
Its fizzy bubbles and grace above
It's the perfect drink, anytime, anyplace
Refreshing as it gives us a taste

Verse 2:
From morning brunch to evening feast
It's the perfect drink for a treat
A sip of it brings a smile so bright
Our thirst is quenched in just one sip so light
...
*/
