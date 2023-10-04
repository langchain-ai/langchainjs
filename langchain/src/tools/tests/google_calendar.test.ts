import { jest, expect, describe } from "@jest/globals";
import { LLM } from "../../llms/base.js";
import {
  GoogleCalendarCreateTool,
  GoogleCalendarViewTool,
} from "../google_calendar/index.js";

jest.mock("googleapis", () => ({
  google: {
    auth: {
      JWT: jest.fn().mockImplementation(() => ({})),
    },
  },
}));

jest.mock("../../util/env.js", () => ({
  getEnvironmentVariable: () => "key",
}));

// jest.mock("../google_calendar/commands/run-create-events.js", () => ({
//   runCreateEvent: jest.fn(),
// }));

// jest.mock("../google_calendar/commands/run-view-events.js", () => ({
//   runViewEvents: jest.fn(),
// }));

class FakeLLM extends LLM {
  _llmType() {
    return "fake";
  }

  async _call(prompt: string): Promise<string> {
    return prompt;
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
