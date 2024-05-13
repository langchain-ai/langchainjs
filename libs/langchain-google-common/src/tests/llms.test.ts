import { expect, test } from "@jest/globals";
import {
  BaseMessage,
  HumanMessageChunk,
  MessageContentComplex,
} from "@langchain/core/messages";
import { ChatPromptValue } from "@langchain/core/prompt_values";
import { GoogleBaseLLM, GoogleBaseLLMInput } from "../llms.js";
import {
  authOptions,
  MockClient,
  MockClientAuthInfo,
  mockFile,
  mockId,
} from "./mock.js";
import { GoogleAISafetyError } from "../utils/safety.js";
import { MessageGeminiSafetyHandler } from "../utils/gemini.js";

class GoogleLLM extends GoogleBaseLLM<MockClientAuthInfo> {
  constructor(fields?: GoogleBaseLLMInput<MockClientAuthInfo>) {
    super(fields);
  }

  buildAbstractedClient(
    fields?: GoogleBaseLLMInput<MockClientAuthInfo>
  ): MockClient {
    const options = authOptions(fields);
    return new MockClient(options);
  }
}

describe("Mock Google LLM", () => {
  test("Setting invalid model parameters", async () => {
    expect(() => {
      const model = new GoogleLLM({
        temperature: 1.2,
      });
      expect(model).toBeNull(); // For linting. Should never reach.
    }).toThrowError(/temperature/);

    expect(() => {
      const model = new GoogleLLM({
        topP: -2,
      });
      expect(model).toBeNull(); // For linting. Should never reach.
    }).toThrowError(/topP/);

    expect(() => {
      const model = new GoogleLLM({
        topP: 2,
      });
      expect(model).toBeNull(); // For linting. Should never reach.
    }).toThrowError(/topP/);

    expect(() => {
      const model = new GoogleLLM({
        topK: -2,
      });
      expect(model).toBeNull(); // For linting. Should never reach.
    }).toThrowError(/topK/);
  });

  test("user agent header", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
    };
    const model = new GoogleLLM({
      authOptions,
    });
    await model.call("Hello world");

    expect(record?.opts?.headers).toHaveProperty("User-Agent");
    expect(record.opts.headers["User-Agent"]).toMatch(
      /langchain-js\/[0-9.]+-GoogleLLMConnection/
    );
  });

  test("platform default", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
    };
    const model = new GoogleLLM({
      authOptions,
    });

    expect(model.platform).toEqual("gcp");
  });

  test("platform set", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
    };
    const model = new GoogleLLM({
      authOptions,
      platformType: "gai",
    });

    expect(model.platform).toEqual("gai");
  });

  test("scope default", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
    };
    // eslint-disable-next-line no-new
    new GoogleLLM({
      authOptions,
    });
    expect(record).toHaveProperty("authOptions");
    expect(record.authOptions).toHaveProperty("scopes");
    expect(Array.isArray(record.authOptions.scopes)).toBeTruthy();
    expect(record.authOptions.scopes).toHaveLength(1);
    expect(record.authOptions.scopes[0]).toEqual(
      "https://www.googleapis.com/auth/cloud-platform"
    );
  });

  test("scope default set", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
    };
    // eslint-disable-next-line no-new
    new GoogleLLM({
      authOptions,
      platformType: "gai",
    });
    expect(record).toHaveProperty("authOptions");
    expect(record.authOptions).toHaveProperty("scopes");
    expect(Array.isArray(record.authOptions.scopes)).toBeTruthy();
    expect(record.authOptions.scopes).toHaveLength(1);
    expect(record.authOptions.scopes[0]).toEqual(
      "https://www.googleapis.com/auth/generative-language"
    );
  });

  test("scope set", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      scopes: ["https://example.com/bogus"],
    };
    // eslint-disable-next-line no-new
    new GoogleLLM({
      authOptions,
    });
    expect(record).toHaveProperty("authOptions");
    expect(record.authOptions).toHaveProperty("scopes");
    expect(Array.isArray(record.authOptions.scopes)).toBeTruthy();
    expect(record.authOptions.scopes).toHaveLength(1);
    expect(record.authOptions.scopes[0]).toEqual("https://example.com/bogus");
  });

  test("1: generateContent", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "llm-1-mock.json",
    };
    const model = new GoogleLLM({
      authOptions,
    });
    const response = await model.invoke("Hello world");

    expect(response).toEqual(
      "1. Sock it to Me!\n2. Heel Yeah Socks\n3. Sole Mates\n4. Happy Soles\n5. Toe-tally Awesome Socks\n6. Sock Appeal\n7. Footsie Wootsies\n8. Thread Heads\n9. Sock Squad\n10. Sock-a-licious\n11. Darn Good Socks\n12. Sockcessories\n13. Sole Searching\n14. Sockstar\n15. Socktopia\n16. Sockology\n17. Elevated Toes\n18. The Urban Sole\n19. The Hippie Sole\n20. Sole Fuel"
    );
    // expect(record.opts.url).toEqual(`https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/gemini-pro:generateContent`)
    console.log("record", JSON.stringify(record, null, 2));
  });

  test("1: invoke", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "llm-1-mock.json",
    };
    const model = new GoogleLLM({
      authOptions,
    });
    const response = await model.invoke("Hello world");
    expect(response).toEqual(
      "1. Sock it to Me!\n2. Heel Yeah Socks\n3. Sole Mates\n4. Happy Soles\n5. Toe-tally Awesome Socks\n6. Sock Appeal\n7. Footsie Wootsies\n8. Thread Heads\n9. Sock Squad\n10. Sock-a-licious\n11. Darn Good Socks\n12. Sockcessories\n13. Sole Searching\n14. Sockstar\n15. Socktopia\n16. Sockology\n17. Elevated Toes\n18. The Urban Sole\n19. The Hippie Sole\n20. Sole Fuel"
    );
    // expect(record.opts.url).toEqual(`https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/gemini-pro:generateContent`)
    console.log("record", JSON.stringify(record, null, 2));
    expect(record.opts).toHaveProperty("data");
    expect(record.opts.data).toHaveProperty("contents");
    expect(record.opts.data.contents).toHaveLength(1);
    expect(record.opts.data.contents[0]).toHaveProperty("parts");

    const parts = record?.opts?.data?.contents[0]?.parts;
    console.log(parts);
    expect(parts).toHaveLength(1);
    expect(parts[0]).toHaveProperty("text");
    expect(parts[0].text).toEqual("Hello world");
  });

  test("2: streamGenerateContent - non-streaming", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "llm-2-mock.json",
    };
    const model = new GoogleLLM({
      authOptions,
    });
    const response = await model.invoke("Hello world");
    const expectedResponse = await mockFile("llm-2-mock.txt");

    expect(response).toEqual(expectedResponse);
    expect(record.opts.url).toEqual(
      `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/gemini-pro:streamGenerateContent`
    );
    console.log("record", JSON.stringify(record, null, 2));
  });

  test("3: streamGenerateContent - streaming", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "llm-3-mock.json",
    };
    const model = new GoogleLLM({
      authOptions,
    });
    const response = await model.stream("Hello world");
    const responseArray: string[] = [];
    for await (const value of response) {
      expect(typeof value).toEqual("string");
      responseArray.push(value);
    }

    expect(responseArray).toHaveLength(6);
    console.log("record", JSON.stringify(record, null, 2));
  });

  test("4: streamGenerateContent - non-streaming - safety exception", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "llm-4-mock.json",
    };
    const model = new GoogleLLM({
      authOptions,
    });
    let caught = false;
    try {
      await model.call("Hello world");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (xx: any) {
      caught = true;
      expect(xx).toBeInstanceOf(GoogleAISafetyError);

      const reply = xx?.reply;
      const expectedReply = await mockFile("llm-4-mock.txt");
      expect(reply).toEqual(expectedReply);
    }
    expect(caught).toEqual(true);
  });

  test("4: streamGenerateContent - non-streaming - safety message", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "llm-4-mock.json",
    };
    const safetyHandler = new MessageGeminiSafetyHandler({
      msg: "I'm sorry Dave, but I can't do that.",
    });
    const model = new GoogleLLM({
      authOptions,
      safetyHandler,
    });
    const reply = await model.invoke("Hello world");
    expect(reply).toContain("I'm sorry Dave, but I can't do that.");
  });

  test("5: streamGenerateContent - streaming - safety exception", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "llm-5-mock.json",
    };
    const model = new GoogleLLM({
      authOptions,
    });
    const response = await model.stream("Hello world");
    const responseArray: string[] = [];
    let caught = false;
    try {
      for await (const value of response) {
        expect(typeof value).toEqual("string");
        responseArray.push(value);
      }
    } catch (xx) {
      caught = true;
      expect(xx).toBeInstanceOf(GoogleAISafetyError);
    }

    expect(responseArray).toHaveLength(4);
    console.log("record", JSON.stringify(record, null, 2));

    expect(caught).toEqual(true);
  });

  test("5: streamGenerateContent - streaming - safety message", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "llm-5-mock.json",
    };
    const safetyHandler = new MessageGeminiSafetyHandler({
      msg: "I'm sorry Dave, but I can't do that.",
    });
    const model = new GoogleLLM({
      authOptions,
      safetyHandler,
    });
    const response = await model.stream("Hello world");
    const responseArray: string[] = [];
    for await (const value of response) {
      expect(typeof value).toEqual("string");
      responseArray.push(value);
    }

    expect(responseArray).toHaveLength(6);
    expect(responseArray[4]).toEqual("I'm sorry Dave, but I can't do that.");
    console.log("record", JSON.stringify(record, null, 2));
  });

  test("6: predictMessages image blue-square", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "llm-6-mock.json",
    };

    const model = new GoogleLLM({
      authOptions,
      model: "gemini-pro-vision",
    });

    const message: MessageContentComplex[] = [
      {
        type: "text",
        text: "What is in this image?",
      },
      {
        type: "image_url",
        image_url: `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAIAAAACUFjqAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH6AIbFwQSRaexCAAAAB1pVFh0Q29tbWVudAAAAAAAQ3JlYXRlZCB3aXRoIEdJTVBkLmUHAAAAJklEQVQY02P8//8/A27AxIAXsEAor31f0CS2OfEQ1j2Q0owU+RsAGNUJD2/04PgAAAAASUVORK5CYII=`,
      },
    ];

    const messages: BaseMessage[] = [
      new HumanMessageChunk({ content: message }),
    ];
    const res = await model.predictMessages(messages);

    console.log("record", record);
    expect(record.opts).toHaveProperty("data");
    expect(record.opts.data).toHaveProperty("contents");
    expect(record.opts.data.contents).toHaveLength(1);
    expect(record.opts.data.contents[0]).toHaveProperty("parts");

    const parts = record?.opts?.data?.contents[0]?.parts;
    console.log(parts);
    expect(parts).toHaveLength(2);
    expect(parts[0]).toHaveProperty("text");
    expect(parts[1]).toHaveProperty("inlineData");
    expect(parts[1].inlineData).toHaveProperty("mimeType");
    expect(parts[1].inlineData).toHaveProperty("data");

    expect(res?.content?.[0]).toEqual({ text: "A blue square.", type: "text" });
  });

  /*
   * This test is skipped because .invoke() converts everything to text
   * only at the moment.
   */
  test("6: invoke image blue-square", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "llm-6-mock.json",
    };

    const model = new GoogleLLM({
      authOptions,
      model: "gemini-pro-vision",
    });

    const message: MessageContentComplex[] = [
      {
        type: "text",
        text: "What is in this image?",
      },
      {
        type: "image_url",
        image_url: `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAIAAAACUFjqAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH6AIbFwQSRaexCAAAAB1pVFh0Q29tbWVudAAAAAAAQ3JlYXRlZCB3aXRoIEdJTVBkLmUHAAAAJklEQVQY02P8//8/A27AxIAXsEAor31f0CS2OfEQ1j2Q0owU+RsAGNUJD2/04PgAAAAASUVORK5CYII=`,
      },
    ];

    const messages: BaseMessage[] = [
      new HumanMessageChunk({ content: message }),
    ];
    const input = new ChatPromptValue(messages);
    const res = await model.invoke(input);

    console.log("record", record);
    expect(record.opts).toHaveProperty("data");
    expect(record.opts.data).toHaveProperty("contents");
    expect(record.opts.data.contents).toHaveLength(1);
    expect(record.opts.data.contents[0]).toHaveProperty("parts");

    const parts = record?.opts?.data?.contents[0]?.parts;
    console.log(parts);
    expect(parts).toHaveLength(2);
    expect(parts[0]).toHaveProperty("text");
    expect(parts[1]).toHaveProperty("inlineData");
    expect(parts[1].inlineData).toHaveProperty("mimeType");
    expect(parts[1].inlineData).toHaveProperty("data");

    expect(res).toEqual("A blue square.");
  });

  /*
   * This test is skipped because .stream() converts everything to text
   * only at the moment.
   */
  test("7: stream image blue-square", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "llm-7-mock.json",
    };
    const model = new GoogleLLM({
      authOptions,
      model: "gemini-pro-image",
    });

    const message: MessageContentComplex[] = [
      {
        type: "text",
        text: "What is in this image?",
      },
      {
        type: "image_url",
        image_url: `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAIAAAACUFjqAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH6AIbFwQSRaexCAAAAB1pVFh0Q29tbWVudAAAAAAAQ3JlYXRlZCB3aXRoIEdJTVBkLmUHAAAAJklEQVQY02P8//8/A27AxIAXsEAor31f0CS2OfEQ1j2Q0owU+RsAGNUJD2/04PgAAAAASUVORK5CYII=`,
      },
    ];

    const messages: BaseMessage[] = [
      new HumanMessageChunk({ content: message }),
    ];

    // const input: BaseLanguageModelInput = [["human", message]]
    const input = new ChatPromptValue(messages);

    const response = await model.stream(input);
    const responseArray: string[] = [];
    for await (const value of response) {
      responseArray.push(value);
    }

    expect(responseArray).toHaveLength(3);
    console.log("record", JSON.stringify(record, null, 2));
  });

  test("8: streamGenerateContent - streaming - json responseMimeType", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "llm-8-mock.json",
    };
    const model = new GoogleLLM({
      authOptions,
      responseMimeType: "application/json",
    });
    const response = await model.stream("Give me a recipe for banana bread.");
    const responseArray: string[] = [];
    for await (const value of response) {
      expect(typeof value).toEqual("string");
      responseArray.push(value);
    }

    expect(responseArray).toHaveLength(10);
    expect(typeof JSON.parse(responseArray.join(""))).toEqual("object");

    console.log("record", JSON.stringify(record, null, 2));
  });

  test("9: streamGenerateContent - non-streaming - check json responseMimeType", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "llm-9-mock.json",
    };
    const model = new GoogleLLM({
      authOptions,
      responseMimeType: "application/json",
    });
    const response = await model.invoke("Give me a recipe for banana bread.");

    expect(typeof JSON.parse(response)).toEqual("object");
    expect(record.opts.data.generationConfig.responseMimeType).toEqual(
      "application/json"
    );

    console.log("record", JSON.stringify(record, null, 2));
  });
});
