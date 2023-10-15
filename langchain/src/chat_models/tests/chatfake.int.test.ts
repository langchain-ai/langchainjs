import { describe, test, expect } from "@jest/globals";
import { FakeListChatModel } from "../fake.js";
import { HumanMessage } from "../../schema/index.js";

describe("Test FakeListChatLLM", () => {
  test("Should exist", async () => {
    const chat = new FakeListChatModel({ responses: ["test response"] });
    const message = new HumanMessage("test message");
    const response = await chat.call([message]);

    expect(typeof response.content).toBe("string");
  });

  test("Should return responses in order", async () => {
    const chat = new FakeListChatModel({
      responses: ["test response 1", "test response 2"],
    });
    const message = new HumanMessage("test message");
    const response1 = await chat.call([message]);
    const response2 = await chat.call([message]);

    expect(response1.content).toBe("test response 1");
    expect(response2.content).toBe("test response 2");
  });

  test("Should reset index when all responses have been returned", async () => {
    const chat = new FakeListChatModel({
      responses: ["test response 1", "test response 2"],
    });
    const message = new HumanMessage("test message");
    const first_response = await chat.call([message]);
    const second_response = await chat.call([message]);
    const third_response = await chat.call([message]);

    expect(first_response.content).toBe("test response 1");
    expect(second_response.content).toBe("test response 2");
    expect(third_response.content).toBe("test response 1");
  });

  test("Should return stop value as response when provided", async () => {
    const chat = new FakeListChatModel({
      responses: ["test response 1", "test response 2"],
    });
    const message = new HumanMessage("test message");
    const response = await chat.call([message], { stop: ["stop"] });

    expect(response.content).toBe("stop");
  });

  test("Should not increment index when stop value is provided", async () => {
    const chat = new FakeListChatModel({
      responses: ["test response 1", "test response 2"],
    });
    const message = new HumanMessage("test message");
    const first_response = await chat.call([message], { stop: ["stop"] });
    const second_response = await chat.call([message]);

    expect(first_response.content).toBe("stop");
    expect(second_response.content).toBe("test response 1");
  });
});
