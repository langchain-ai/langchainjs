import { test } from "@jest/globals";
import { OpenAIChat } from "../../../llms/openai-chat.js";
import { ConsoleCallbackHandler } from "../../../callbacks/handlers/console.js";
import { OpenAIEmbeddings } from "../../../embeddings/openai.js";
import { MultiRetrievalQAChain } from "../multi_retrieval_qa.js";
import { MemoryVectorStore } from "../../../vectorstores/memory.js";

test("Test MultiPromptChain", async () => {
  const embeddings = new OpenAIEmbeddings();
  const aquaTeen = await MemoryVectorStore.fromTexts(
    [
      "My name is shake zula, the mike rula, the old schoola, you want a trip I'll bring it to ya",
      "Frylock and I'm on top rock you like a cop meatwad you're up next with your knock knock",
      "Meatwad make the money see meatwad get the honeys g drivin' in my car livin' like a star",
      "Ice on my fingers and my toes and I'm a taurus uh check-check it yeah",
      "Cause we are the Aqua Teens make the homies say ho and the girlies wanna scream",
      "Aqua Teen Hunger Force number one in the hood G",
    ],
    { series: "Aqua Teen Hunger Force" },
    embeddings
  );
  const mst3k = await MemoryVectorStore.fromTexts(
    [
      "In the not too distant future next Sunday A.D. There was a guy named Joel not too different from you or me. He worked at Gizmonic Institute, just another face in a red jumpsuit",
      "He did a good job cleaning up the place but his bosses didn't like him so they shot him into space. We'll send him cheesy movies the worst we can find He'll have to sit and watch them all and we'll monitor his mind",
      "Now keep in mind Joel can't control where the movies begin or end Because he used those special parts to make his robot friends. Robot Roll Call Cambot Gypsy Tom Servo Croooow",
      "If you're wondering how he eats and breathes and other science facts La la la just repeat to yourself it's just a show I should really just relax. For Mystery Science Theater 3000",
    ],
    { series: "Mystery Science Theater 3000" },
    embeddings
  );
  const animaniacs = await MemoryVectorStore.fromTexts(
    [
      "It's time for Animaniacs And we're zany to the max So just sit back and relax You'll laugh 'til you collapse We're Animaniacs",
      "Come join the Warner Brothers And the Warner Sister Dot Just for fun we run around the Warner movie lot",
      "They lock us in the tower whenever we get caught But we break loose and then vamoose And now you know the plot",
      "We're Animaniacs, Dot is cute, and Yakko yaks, Wakko packs away the snacks While Bill Clinton plays the sax",
      "We're Animaniacs Meet Pinky and the Brain who want to rule the universe Goodfeathers flock together Slappy whacks 'em with her purse",
      "Buttons chases Mindy while Rita sings a verse The writers flipped we have no script Why bother to rehearse",
      "We're Animaniacs We have pay-or-play contracts We're zany to the max There's baloney in our slacks",
      "We're Animanie Totally insaney Here's the show's namey",
      "Animaniacs Those are the facts",
    ],
    { series: "Animaniacs" },
    embeddings
  );

  const llm = new OpenAIChat({
    callbacks: [new ConsoleCallbackHandler()],
  });

  const retrieverNames = ["aqua teen", "mst3k", "animaniacs"];
  const retrieverDescriptions = [
    "Good for answering questions about Aqua Teen Hunger Force theme song",
    "Good for answering questions about Mystery Science Theater 3000 theme song",
    "Good for answering questions about Animaniacs theme song",
  ];
  const retrievers = [
    aquaTeen.asRetriever(3),
    mst3k.asRetriever(3),
    animaniacs.asRetriever(3),
  ];

  const multiRetrievalQAChain = MultiRetrievalQAChain.fromRetrievers(
    llm,
    retrieverNames,
    retrieverDescriptions,
    retrievers
  );
  const testPromise1 = multiRetrievalQAChain.call({
    input:
      "In the Aqua Teen Hunger Force theme song, who calls himself the mike rula?",
  });

  const testPromise2 = multiRetrievalQAChain.call({
    input:
      "In the Mystery Science Theater 3000 theme song, who worked at Gizmonic Institute?",
  });

  const testPromise3 = multiRetrievalQAChain.call({
    input:
      "In the Animaniacs theme song, who plays the sax while Wakko packs away the snacks?",
  });

  const [{ text: result1 }, { text: result2 }, { text: result3 }] =
    await Promise.all([testPromise1, testPromise2, testPromise3]);

  console.log(result1, result2, result3);
});
