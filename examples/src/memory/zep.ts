import {
  ZepChatMessageHistory,
  ZepMemory,
  ZepMemoryInput,
} from "../../../langchain/src/memory/zep_memory.js";

export const run = async () => {
  // Create an instance of ZepChatMessageHistory
  const chatHistory = new ZepChatMessageHistory(
    "TestSessionA",
    process.env.ZEP_URL || "http://localhost:8000"
  );

  // Use the instance to call its methods
  await chatHistory.addUserMessage("Who was Octavia Butler?");
  await chatHistory.addAIChatMessage(
    "Octavia Estelle Butler (June 22, 1947 – February " +
      "24, 2006) was an American science fiction author."
  );

  await chatHistory.addUserMessage(
    "Which books of hers were made into movies?"
  );
  await chatHistory.addAIChatMessage(
    "The most well-known adaptation of Octavia Butler's " +
      "work is the FX series Kindred, based on her novel of the same name."
  );

  await chatHistory.addUserMessage("What awards did she win?");
  await chatHistory.addAIChatMessage(
    "Octavia Butler won the Hugo Award, the Nebula Award, " +
      "and the MacArthur Fellowship."
  );

  await chatHistory.addUserMessage("What was her most famous book?");
  await chatHistory.addAIChatMessage(
    "Her most famous book is Kindred, which was published in 1979."
  );

  await chatHistory.addUserMessage(
    "Which other women sci-fi weiters might I want to read?"
  );
  await chatHistory.addAIChatMessage(
    "You might want to read Ursula K. Le Guin or Joanna Russ."
  );

  await chatHistory.addUserMessage("What is the Parable of the Sower about?");
  await chatHistory.addAIChatMessage(
    "Parable of the Sower is a science fiction novel by Octavia Butler," +
      "Parable of the Sower is a science fiction novel by Octavia Butler," +
      " published in 1993. It follows the story of Lauren Olamina, a young woman" +
      " living in a dystopian future where society has collapsed due to" +
      " environmental disasters, poverty, and violence."
  );

  // Retrieve and log the chat messages
  const messages = await chatHistory.getMessages();
  console.log(messages);

  // Search the Zep memory for chat messages matching a specified query
  const searchResults = await chatHistory.search("Octavia Butler", 3);
  console.log(searchResults);

  // Clear the Zep memory
  await chatHistory.clear();
};
