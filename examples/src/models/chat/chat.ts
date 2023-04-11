import { ChatOpenAI } from "langchain/chat_models/openai";
import { HumanChatMessage, SystemChatMessage } from "langchain/schema";

export const run = async () => {
  const chat = new ChatOpenAI({ modelName: "gpt-3.5-turbo" });
  // Pass in a list of messages to `call` to start a conversation. In this simple example, we only pass in one message.
  const responseA = await chat.call([
    new HumanChatMessage(
      "What is a good name for a company that makes colorful socks?"
    ),
  ]);
  console.log(responseA);
  // AIChatMessage { text: '\n\nRainbow Sox Co.' }

  // You can also pass in multiple messages to start a conversation.
  // The first message is a system message that describes the context of the conversation.
  // The second message is a human message that starts the conversation.
  const responseB = await chat.call([
    new SystemChatMessage(
      "You are a helpful assistant that translates English to French."
    ),
    new HumanChatMessage("Translate: I love programming."),
  ]);
  console.log(responseB);
  // AIChatMessage { text: "J'aime programmer." }

  // Similar to LLMs, you can also use `generate` to generate chat completions for multiple sets of messages.
  const responseC = await chat.generate([
    [
      new SystemChatMessage(
        "You are a helpful assistant that translates English to French."
      ),
      new HumanChatMessage(
        "Translate this sentence from English to French. I love programming."
      ),
    ],
    [
      new SystemChatMessage(
        "You are a helpful assistant that translates English to French."
      ),
      new HumanChatMessage(
        "Translate this sentence from English to French. I love artificial intelligence."
      ),
    ],
  ]);
  console.log(responseC);
  /*
  {
    generations: [
      [
        {
          text: "J'aime programmer.",
          message: AIChatMessage { text: "J'aime programmer." },
        }
      ],
      [
        {
          text: "J'aime l'intelligence artificielle.",
          message: AIChatMessage { text: "J'aime l'intelligence artificielle." }
        }
      ]
    ]
  }
  */
};
