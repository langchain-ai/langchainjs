import { expect, test } from "@jest/globals";
import { GoogleBaseLLM, GoogleBaseLLMInput } from "../llms.js";
import {
  authOptions,
  MockClient,
  MockClientAuthInfo,
  mockFile,
  mockId,
} from "./mock.js";
import {GoogleAISafetyError} from "../utils/safety.js";

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
    const response = await model.call("Hello world");

    expect(response).toEqual(
      "1. Sock it to Me!\n2. Heel Yeah Socks\n3. Sole Mates\n4. Happy Soles\n5. Toe-tally Awesome Socks\n6. Sock Appeal\n7. Footsie Wootsies\n8. Thread Heads\n9. Sock Squad\n10. Sock-a-licious\n11. Darn Good Socks\n12. Sockcessories\n13. Sole Searching\n14. Sockstar\n15. Socktopia\n16. Sockology\n17. Elevated Toes\n18. The Urban Sole\n19. The Hippie Sole\n20. Sole Fuel"
    );
    // expect(record.opts.url).toEqual(`https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/gemini-pro:generateContent`)
    console.log("record", JSON.stringify(record, null, 2));
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
    const response = await model.call("Hello world");
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
      responseArray.push(value);
    }

    expect(responseArray).toHaveLength(6);
    console.log("record", JSON.stringify(record, null, 2));
  });

  test("4: streamGenerateContent - non-streaming - safety", async () => {
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

  test("5: streamGenerateContent - streaming - safety", async () => {
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

});
