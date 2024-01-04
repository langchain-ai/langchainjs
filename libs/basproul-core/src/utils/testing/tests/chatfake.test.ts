import { describe, test, expect, jest } from "@jest/globals";
import { HumanMessage } from "../../../messages/index.js";
import { StringOutputParser } from "../../../output_parsers/string.js";
import { FakeListChatModel } from "../index.js";

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

  test("Should return responses after sleep if requested", async () => {
    const chat = new FakeListChatModel({
      responses: ["test response 1", "test response 2"],
      sleep: 10,
    });
    const sleepSpy = jest.spyOn(chat, "_sleep");
    const message = new HumanMessage("test message");
    await chat.call([message]);

    expect(sleepSpy).toHaveBeenCalledTimes(1);
  }, 30000);

  test("Should stream responses if requested", async () => {
    const chat = new FakeListChatModel({
      responses: ["test response 1", "test response 2"],
    });
    const chunks = [];

    const response = await chat
      .pipe(new StringOutputParser())
      .stream("Test message");
    for await (const chunk of response) {
      chunks.push(chunk);
    }

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join("")).toBe("test response 1");
  });

  test("Should return responses in order when streaming", async () => {
    const chat = new FakeListChatModel({
      responses: ["test response 1", "test response 2"],
    });
    const chunks1 = [];
    const chunks2 = [];

    const response1 = await chat
      .pipe(new StringOutputParser())
      .stream("Test message");
    for await (const chunk of response1) {
      chunks1.push(chunk);
    }
    const response2 = await chat
      .pipe(new StringOutputParser())
      .stream("Test message");
    for await (const chunk of response2) {
      chunks2.push(chunk);
    }

    expect(chunks1.join("")).toBe("test response 1");
    expect(chunks2.join("")).toBe("test response 2");
  });

  test("Should stream responses after sleep if requested", async () => {
    const chat = new FakeListChatModel({
      responses: ["test response 1", "test response 2"],
      sleep: 10,
    });
    const sleepSpy = jest.spyOn(chat, "_sleep");
    const chunks = [];

    const response = await chat
      .pipe(new StringOutputParser())
      .stream("Test message");
    for await (const chunk of response) {
      chunks.push(chunk);
    }

    expect(sleepSpy).toHaveBeenCalledTimes(chunks.length);
  }, 30000);
});
