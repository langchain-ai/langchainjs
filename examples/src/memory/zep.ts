import { BufferMemory } from "langchain/memory";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { ConversationChain } from "langchain/chains";

import { ZepChatMessageHistory } from "../../../langchain/src/memory/zep_memory.js";

export const run = async () => {
  // Create an instance of ZepChatMessageHistory
  const chatHistory = new ZepChatMessageHistory(
    "TestSessionAB",
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
  /*
    messages: This is the response from getMessages()
    [
    AIChatMessage {
      text: 'Parable of the Sower is a science fiction novel by Octavia Butler,Parable of the Sower is a science fiction novel by Octavia Butler, published in 1993. It follows the story of Lauren Olamina, a young woman living in a dystopian future where society has collapsed due to environmental disasters, poverty, and violence.'
    },
    HumanChatMessage { text: 'What is the Parable of the Sower about?' },
    AIChatMessage {
      text: 'You might want to read Ursula K. Le Guin or Joanna Russ.'
    },
    HumanChatMessage {
      text: 'Which other women sci-fi weiters might I want to read?'
    },
    AIChatMessage {
      text: 'Her most famous book is Kindred, which was published in 1979.'
    },
    HumanChatMessage { text: 'What was her most famous book?' },
    AIChatMessage {
      text: 'Octavia Butler won the Hugo Award, the Nebula Award, and the MacArthur Fellowship.'
    },
    HumanChatMessage { text: 'What awards did she win?' },
    AIChatMessage {
      text: "The most well-known adaptation of Octavia Butler's work is the FX series Kindred, based on her novel of the same name."
    },
    HumanChatMessage {
      text: 'Which books of hers were made into movies?'
    },
    AIChatMessage {
      text: 'Octavia Estelle Butler (June 22, 1947 – February 24, 2006) was an American science fiction author.'
    },
    HumanChatMessage { text: 'Who was Octavia Butler?' }
    ]
  */

  // Search the Zep memory for chat messages matching a specified query
  const searchResults = await chatHistory.search("Octavia Butler", 3);
  console.log(searchResults);
  /*
    searchResults: This is the response from search()
    [
      SearchResult {
        message: Message {
          uuid: 'a989a467-1794-4333-9e6b-4766e383d852',
          created_at: '2023-05-23T23:03:58.625558Z',
          role: 'human',
          content: 'Who was Octavia Butler?',
          token_count: 8
        },
        meta: {},
        score: undefined,
        summary: null,
        dist: 0.9451673508603058
      },
      SearchResult {
        message: Message {
          uuid: '9fe405c7-60ff-46d3-b0f3-380c136c36f8',
          created_at: '2023-05-23T23:03:58.642475Z',
          role: 'ai',
          content: 'Octavia Estelle Butler (June 22, 1947 – February 24, 2006) was an American science fiction author.',
          token_count: 31
        },
        meta: {},
        score: undefined,
        summary: null,
        dist: 0.9331205063596482
      },
      SearchResult {
        message: Message {
          uuid: '80d41add-dace-4b8e-abc8-4af411f156ed',
          created_at: '2023-05-23T23:03:58.657743Z',
          role: 'ai',
          content: 'Octavia Butler won the Hugo Award, the Nebula Award, and the MacArthur Fellowship.',
          token_count: 21
        },
        meta: {},
        score: undefined,
        summary: null,
        dist: 0.911849124772129
      },
    ]
  */

  // Clear the Zep memory
  await chatHistory.clear();
};
