import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import neo4j from "neo4j-driver";
import { Neo4jChatMessageHistory } from "../message/neo4j.js";

const goodConfig = {
  url: "bolt://host.docker.internal:7687",
  username: "neo4j",
  password: "langchain",
};

describe("The Neo4jChatMessageHistory class", () => {
  describe("Test suite", () => {
    it("Runs at all", () => {
      expect(true).toEqual(true);
    });
  });

  describe("Class instantiation", () => {
    it("Requires a url, username and password, throwing an error if not provided", async () => {
      const badConfig = {};
      await expect(
        // @ts-expect-error Bad config
        Neo4jChatMessageHistory.initialize(badConfig)
      ).rejects.toThrow(neo4j.Neo4jError);
    });

    it("Creates a class instance from - at minimum - a url, username and password", async () => {
      const instance = await Neo4jChatMessageHistory.initialize(goodConfig);
      expect(instance).toBeInstanceOf(Neo4jChatMessageHistory);
      await instance.close();
    });

    it("Class instances have expected, configurable fields, and sensible defaults", async () => {
      const instance = await Neo4jChatMessageHistory.initialize(goodConfig);

      expect(instance.sessionId).toBeDefined();
      expect(instance.sessionNodeLabel).toEqual("ChatSession");
      expect(instance.windowSize).toEqual(3);
      expect(instance.messageNodeLabel).toEqual("ChatMessage");

      const secondInstance = await Neo4jChatMessageHistory.initialize({
        ...goodConfig,
        sessionId: "Shibboleet",
        sessionNodeLabel: "Conversation",
        messageNodeLabel: "Communication",
        windowSize: 4,
      });

      expect(secondInstance.sessionId).toBeDefined();
      expect(secondInstance.sessionId).toEqual("Shibboleet");
      expect(instance.sessionId).not.toEqual(secondInstance.sessionId);
      expect(secondInstance.sessionNodeLabel).toEqual("Conversation");
      expect(secondInstance.messageNodeLabel).toEqual("Communication");
      expect(secondInstance.windowSize).toEqual(4);

      await instance.close();
      await secondInstance.close();
    });
  });

  describe("Core functionality", () => {
    let instance: undefined | Neo4jChatMessageHistory;

    beforeEach(async () => {
      instance = await Neo4jChatMessageHistory.initialize(goodConfig);
    });

    afterEach(async () => {
      await instance?.clear();
      await instance?.close();
    });

    it("Connects verifiably to the underlying Neo4j database", async () => {
      const connected = await instance?.verifyConnectivity();
      expect(connected).toBeDefined();
    });

    it("getMessages()", async () => {
      let results = await instance?.getMessages();
      expect(results).toEqual([]);
      const messages = [
        new HumanMessage(
          "My first name is a random set of numbers and letters"
        ),
        new AIMessage("And other alphanumerics that changes hourly forever"),
        new HumanMessage(
          "My last name, a thousand vowels fading down a sinkhole to a susurrus"
        ),
        new AIMessage("It couldn't just be John Doe or Bingo"),
        new HumanMessage(
          "My address, a made-up language written out in living glyphs"
        ),
        new AIMessage("Lifted from demonic literature and religious text"),
        new HumanMessage("Telephone: uncovered by purveyors of the ouija"),
        new AIMessage("When checked against the CBGB women's room graffiti"),
        new HumanMessage("My social: a sudoku"),
        new AIMessage("My age is obscure"),
      ];
      await instance?.addMessages(messages);
      results = (await instance?.getMessages()) || [];
      const windowSize = instance?.windowSize || 0;
      expect(results.length).toEqual(windowSize * 2);
      expect(results).toEqual(messages.slice(windowSize * -2));
    });

    it("addMessage()", async () => {
      const messages = [
        new HumanMessage("99 Bottles of beer on the wall, 99 bottles of beer!"),
        new AIMessage(
          "Take one down, pass it around, 98 bottles of beer on the wall."
        ),
        new HumanMessage("How many bottles of beer are currently on the wall?"),
        new AIMessage("There are currently 98 bottles of beer on the wall."),
      ];
      for (const message of messages) {
        await instance?.addMessage(message);
      }
      const results = await instance?.getMessages();
      expect(results).toEqual(messages);
    });

    it("clear()", async () => {
      const messages = [
        new AIMessage("I'm not your enemy."),
        new HumanMessage("That sounds like something that my enemy would say."),
        new AIMessage("You're being difficult."),
        new HumanMessage("I'm being guarded."),
      ];
      await instance?.addMessages(messages);
      let results = await instance?.getMessages();
      expect(results).toEqual(messages);
      await instance?.clear();
      results = await instance?.getMessages();
      expect(results).toEqual([]);
    });
  });
});
