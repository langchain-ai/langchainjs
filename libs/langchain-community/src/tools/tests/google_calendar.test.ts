import { jest, expect, describe } from "@jest/globals";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatResult } from "@langchain/core/outputs";
import {
  GoogleCalendarCreateTool,
  GoogleCalendarViewTool,
  GoogleCalendarDeleteTool,
} from "../google_calendar/index.js";

jest.mock("googleapis", () => ({
  google: {
    auth: {
      JWT: jest.fn().mockImplementation(() => ({})),
    },
  },
}));

jest.mock("@langchain/core/utils/env", () => ({
  getEnvironmentVariable: () => "key",
}));

class FakeLLM extends BaseChatModel {
  _llmType() {
    return "fake";
  }

  async _generate() {
    return {} as unknown as ChatResult;
  }
}

describe("GoogleCalendarCreateTool", () => {
  it("should be setup with correct parameters", async () => {
    const params = {
      credentials: {
        clientEmail: "test@email.com",
        privateKey: "privateKey",
        calendarId: "calendarId",
      },
      model: new FakeLLM({}),
    };

    const instance = new GoogleCalendarCreateTool(params);
    expect(instance.name).toBe("google_calendar_create");
  });

  it("should be setup with accessToken", async () => {
    const params = {
      credentials: {
        accessToken: "accessToken",
        calendarId: "calendarId",
      },
      model: new FakeLLM({}),
    };

    const instance = new GoogleCalendarCreateTool(params);
    expect(instance.name).toBe("google_calendar_create");
  });

  it("should be setup with accessToken function", async () => {
    const params = {
      credentials: {
        accessToken: () => Promise.resolve("accessToken"),
        calendarId: "calendarId",
      },
      model: new FakeLLM({}),
    };

    const instance = new GoogleCalendarCreateTool(params);
    expect(instance.name).toBe("google_calendar_create");
  });

  it("should throw an error if missing credentials", async () => {
    const params = {
      credentials: {},
      model: new FakeLLM({}),
    };
    expect(() => new GoogleCalendarCreateTool(params)).toThrow(
      "Missing GOOGLE_CALENDAR_CLIENT_EMAIL to interact with Google Calendar"
    );
  });

  it("should throw an error if missing model", async () => {
    const params = {
      credentials: {
        clientEmail: "test",
      },
    };
    expect(() => new GoogleCalendarCreateTool(params)).toThrow(
      "Missing llm instance to interact with Google Calendar"
    );
  });
});

describe("GoogleCalendarViewTool", () => {
  it("should be setup with correct parameters", async () => {
    const params = {
      credentials: {
        clientEmail: "test@email.com",
        privateKey: "privateKey",
        calendarId: "calendarId",
      },
      model: new FakeLLM({}),
    };

    const instance = new GoogleCalendarViewTool(params);
    expect(instance.name).toBe("google_calendar_view");
  });

  it("should be setup with accessToken", async () => {
    const params = {
      credentials: {
        accessToken: "accessToken",
        calendarId: "calendarId",
      },
      model: new FakeLLM({}),
    };

    const instance = new GoogleCalendarViewTool(params);
    expect(instance.name).toBe("google_calendar_view");
  });

  it("should throw an error if missing credentials", async () => {
    const params = {
      credentials: {},
      model: new FakeLLM({}),
    };
    expect(() => new GoogleCalendarViewTool(params)).toThrow(
      "Missing GOOGLE_CALENDAR_CLIENT_EMAIL to interact with Google Calendar"
    );
  });

  it("should throw an error if missing model", async () => {
    const params = {
      credentials: {
        clientEmail: "test",
      },
    };
    expect(() => new GoogleCalendarViewTool(params)).toThrow(
      "Missing llm instance to interact with Google Calendar"
    );
  });
});

describe("GoogleCalendarDeleteTool", () => {
  it("should be setup with correct parameters", async () => {
    const params = {
      credentials: {
        clientEmail: "test@email.com",
        privateKey: "privateKey",
        calendarId: "calendarId",
      },
      model: new FakeLLM({}),
    };

    const instance = new GoogleCalendarDeleteTool(params);
    expect(instance.name).toBe("google_calendar_delete");
  });

  it("should be setup with accessToken", async () => {
    const params = {
      credentials: {
        accessToken: "accessToken",
        calendarId: "calendarId",
      },
      model: new FakeLLM({}),
    };

    const instance = new GoogleCalendarDeleteTool(params);
    expect(instance.name).toBe("google_calendar_delete");
  });

  it("should throw an error if missing credentials", async () => {
    const params = {
      credentials: {},
      model: new FakeLLM({}),
    };
    expect(() => new GoogleCalendarDeleteTool(params)).toThrow(
      "Missing GOOGLE_CALENDAR_CLIENT_EMAIL to interact with Google Calendar"
    );
  });

  it("should throw an error if missing model", async () => {
    const params = {
      credentials: {
        clientEmail: "test",
      },
    };
    expect(() => new GoogleCalendarDeleteTool(params)).toThrow(
      "Missing llm instance to interact with Google Calendar"
    );
  });
});
