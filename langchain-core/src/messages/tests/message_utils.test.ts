import { test, expect } from "@jest/globals";
import { filterMessages} from "../utils.js";
import { AIMessage } from "../ai.js";
import { HumanMessage } from "../human.js";
import { SystemMessage } from "../system.js";

test("filterMessages works", () => {
 const messages = [
   new SystemMessage("you're a good assistant."),
   new HumanMessage({ content: "what's your name", id: "foo", name: "example_user" }),
   new AIMessage({ content: "steve-o", id: "bar", name: "example_assistant" }),
   new HumanMessage({ content: "what's your favorite color", id: "baz" }),
   new AIMessage({ content: "silicon blue" , id: "blah" }),
 ];

 const filteredMessages = filterMessages(messages, {
   includeNames: ["example_user", "example_assistant"],
   includeTypes: ["system"],
   excludeIds: ["bar"],
 });
 console.log(filteredMessages)
 expect(filteredMessages).toEqual([
  new SystemMessage("you're a good assistant."),
  new HumanMessage({ content: "what's your name", id: "foo", name: "example_user" }),
 ]);
})