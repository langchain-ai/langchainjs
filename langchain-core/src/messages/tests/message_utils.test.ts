import { test, expect } from "@jest/globals";
import { filterMessages, mergeMessageRuns } from "../utils.js";
import { AIMessage } from "../ai.js";
import { HumanMessage } from "../human.js";
import { SystemMessage } from "../system.js";

test("filterMessages works", () => {
  const messages = [
    new SystemMessage("you're a good assistant."),
    new HumanMessage({
      content: "what's your name",
      id: "foo",
      name: "example_user",
    }),
    new AIMessage({ content: "steve-o", id: "bar", name: "example_assistant" }),
    new HumanMessage({ content: "what's your favorite color", id: "baz" }),
    new AIMessage({ content: "silicon blue", id: "blah" }),
  ];

  const filteredMessages = filterMessages(messages, {
    includeNames: ["example_user", "example_assistant"],
    includeTypes: ["system"],
    excludeIds: ["bar"],
  });
  expect(filteredMessages).toEqual([
    new SystemMessage("you're a good assistant."),
    new HumanMessage({
      content: "what's your name",
      id: "foo",
      name: "example_user",
    }),
  ]);
});

test("mergeMessageRuns works", () => {
  const messages = [
    new SystemMessage("you're a good assistant."),
    new HumanMessage({ content: "what's your favorite color", id: "foo" }),
    new HumanMessage({ content: "wait your favorite food", id: "bar" }),
    new AIMessage({
      content: "my favorite colo",
      tool_calls: [{ name: "blah_tool", args: { x: 2 }, id: "123" }],
      id: "baz",
    }),
    new AIMessage({
      content: [{ type: "text", text: "my favorite dish is lasagna" }],
      tool_calls: [{ name: "blah_tool", args: { x: -10 }, id: "456" }],
      id: "blur",
    }),
  ];

  const mergedMessages = mergeMessageRuns(messages);
  expect(mergedMessages).toHaveLength(3);
  expect(mergedMessages).toEqual([
    new SystemMessage("you're a good assistant."),
    new HumanMessage({
      content: "what's your favorite colorwait your favorite food",
      id: "foo",
    }),
    new AIMessage({
      content: [
        { type: "text", text: "my favorite colo" },
        { type: "text", text: "my favorite dish is lasagna" },
      ],
      tool_calls: [
        { name: "blah_tool", args: { x: 2 }, id: "123" },
        { name: "blah_tool", args: { x: -10 }, id: "456" },
      ],
      id: "baz",
    }),
  ]);
});
