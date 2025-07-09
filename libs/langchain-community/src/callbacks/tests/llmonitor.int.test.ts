import { test } from "@jest/globals";

import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

import { LLMonitorHandler } from "../handlers/llmonitor.js";

test.skip("Test traced chat call with tags", async () => {
  const chat = new ChatOpenAI({
    model: "gpt-4o-mini",
    callbacks: [new LLMonitorHandler({ verbose: true })],
  });

  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const response = await chat.invoke([
    new HumanMessage(
      "What is a good name for a company that makes colorful socks?"
    ),
  ]);
  // console.log(response.content);

  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const response2 = await chat.invoke([
    new SystemMessage(
      "You are a helpful assistant that translates English to French."
    ),
    new HumanMessage("Translate: I love programming."),
  ]);
  // console.log(response2.content);
});
