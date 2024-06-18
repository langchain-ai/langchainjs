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
  console.log(filteredMessages);
  expect(filteredMessages).toEqual([
    new SystemMessage("you're a good assistant."),
    new HumanMessage({
      content: "what's your name",
      id: "foo",
      name: "example_user",
    }),
  ]);
});

test.only("mergeMessageRuns works", () => {
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
  const [firstMessage, secondMessage, thirdMessage] = mergedMessages;
  if (!firstMessage || !secondMessage || !thirdMessage) {
    throw new Error("Something went wrong");
  } else if (
    !(firstMessage instanceof SystemMessage) ||
    !(secondMessage instanceof HumanMessage) ||
    !(thirdMessage instanceof AIMessage)
  ) {
    throw new Error("Something went wrong with instanceof checks.");
  }
  expect(firstMessage).toEqual(new SystemMessage("you're a good assistant."));
  expect(secondMessage).toEqual(
    new HumanMessage({
      content: "what's your favorite colorwait your favorite food",
      id: "foo",
    })
  );
  console.log(thirdMessage);
  expect(thirdMessage).toEqual(
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
    })
  );
});
