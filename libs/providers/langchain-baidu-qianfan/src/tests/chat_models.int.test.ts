import { test, expect } from "vitest";

import { HumanMessage } from "@langchain/core/messages";
import { ChatBaiduQianfan } from "../chat_models.js";

test("invoke", async () => {
  const chat = new ChatBaiduQianfan({
    model: "ERNIE-Lite-8K",
  });
  const message = new HumanMessage("北京天气");
  const res = await chat.invoke([message]);
  // console.log(res.content);
  expect(res.content.length).toBeGreaterThan(10);
});

test("invokeWithStream", async () => {
  const chat = new ChatBaiduQianfan({
    model: "ERNIE-Lite-8K",
    streaming: true,
  });
  const message = new HumanMessage("等额本金和等额本息有什么区别？");
  const res = await chat.invoke([message]);
  // console.log({ res });
  expect(res.content.length).toBeGreaterThan(10);
});
