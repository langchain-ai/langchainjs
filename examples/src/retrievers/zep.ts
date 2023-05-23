/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ZepRetriever } from "langchain/retrievers/zep";
import { ZepClient, Memory, Message } from "zep-js";

export const run = async () => {
  const url = process.env.ZEP_URL || "http://localhost:8000";
  const sessionID = "TestSession1232";
  console.log(`Session ID: ${sessionID}`);
  // Session ID

  const zepClient = new ZepClient(url);

  // Add memory
  try {
    const history = [
      { role: "human", content: "Who was Octavia Butler?" },
      {
        role: "ai",
        content:
          "Octavia Estelle Butler (June 22, 1947 – February 24, 2006) was an American" +
          " science fiction author.",
      },
      { role: "human", content: "Which books of hers were made into movies?" },
      {
        role: "ai",
        content:
          "The most well-known adaptation of Octavia Butler's work is the FX series" +
          " Kindred, based on her novel of the same name.",
      },
      { role: "human", content: "Who were her contemporaries?" },
      {
        role: "ai",
        content:
          "Octavia Butler's contemporaries included Ursula K. Le Guin, Samuel R." +
          " Delany, and Joanna Russ.",
      },
      { role: "human", content: "What awards did she win?" },
      {
        role: "ai",
        content:
          "Octavia Butler won the Hugo Award, the Nebula Award, and the MacArthur" +
          " Fellowship.",
      },
      {
        role: "human",
        content: "Which other women sci-fi writers might I want to read?",
      },
      {
        role: "ai",
        content: "You might want to read Ursula K. Le Guin or Joanna Russ.",
      },
      {
        role: "human",
        content:
          "Write a short synopsis of Butler's book, Parable of the Sower. What is it" +
          " about?",
      },
      {
        role: "ai",
        content:
          "Parable of the Sower is a science fiction novel by Octavia Butler," +
          " published in 1993. It follows the story of Lauren Olamina, a young woman" +
          " living in a dystopian future where society has collapsed due to" +
          " environmental disasters, poverty, and violence.",
      },
    ];

    const messages = history.map(
      ({ role, content }) => new Message({ role, content })
    );
    const memory = new Memory({ messages });

    await zepClient.addMemory(sessionID, memory);
  } catch (error) {
    console.debug("Got error:", error);
  }

  const retriever = new ZepRetriever(sessionID, url);

  const query = "Parable of the Sower";
  const docs = await retriever.getRelevantDocuments(query);

  console.log(docs);
};
