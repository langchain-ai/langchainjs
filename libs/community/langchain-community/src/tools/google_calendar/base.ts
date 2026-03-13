import { google, calendar_v3 } from "googleapis";
import { Tool } from "@langchain/core/tools";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { BaseLanguageModel } from "@langchain/core/language_models/base";

export interface GoogleCalendarAgentParams {
  credentials?: {
    clientEmail?: string;
    privateKey?: string;
    keyfile?: string;
    subject?: string;
    accessToken?: string | (() => Promise<string>);
    calendarId?: string;
  };
  scopes?: string[];
  model?: BaseLanguageModel;
}

export class GoogleCalendarBase extends Tool {
  name = "Google Calendar";

  description =
    "A tool to lookup Google Calendar events and create events in Google Calendar";

  protected calendarId: string;

  protected llm: BaseLanguageModel;

  protected params: GoogleCalendarAgentParams;

  protected calendar?: calendar_v3.Calendar;

  constructor(
    { credentials, scopes, model }: GoogleCalendarAgentParams = {
      credentials: {
        clientEmail: getEnvironmentVariable("GOOGLE_CALENDAR_CLIENT_EMAIL"),
        privateKey: getEnvironmentVariable("GOOGLE_CALENDAR_PRIVATE_KEY"),
        keyfile: getEnvironmentVariable("GOOGLE_CALENDAR_KEYFILE"),
        subject: getEnvironmentVariable("GOOGLE_CALENDAR_SUBJECT"),
        calendarId:
          getEnvironmentVariable("GOOGLE_CALENDAR_CALENDAR_ID") || "primary",
      },
      scopes: [
        "https://www.googleapis.com/auth/calendar",
        "https://www.googleapis.com/auth/calendar.events",
      ],
    }
  ) {
    super(...arguments);

    if (!model) {
      throw new Error("Missing llm instance to interact with Google Calendar");
    }

    if (!credentials) {
      throw new Error("Missing credentials to authenticate to Google Calendar");
    }

    if (!credentials.accessToken) {
      if (!credentials.clientEmail) {
        throw new Error(
          "Missing GOOGLE_CALENDAR_CLIENT_EMAIL to interact with Google Calendar"
        );
      }

      if (!credentials.privateKey && !credentials.keyfile) {
        throw new Error(
          "Missing GOOGLE_CALENDAR_PRIVATE_KEY or GOOGLE_CALENDAR_KEYFILE or accessToken to interact with Google Calendar"
        );
      }
    }

    if (!credentials.calendarId) {
      throw new Error(
        "Missing GOOGLE_CALENDAR_CALENDAR_ID to interact with Google Calendar"
      );
    }

    this.params = { credentials, scopes };
    this.calendarId = credentials.calendarId;
    this.llm = model;
  }

  getModel() {
    return this.llm;
  }

  async getCalendarClient() {
    const { credentials, scopes } = this.params;

    if (credentials?.accessToken) {
      // always return a new instance so that we don't end up using expired access tokens
      const auth = new google.auth.OAuth2();
      const accessToken =
        typeof credentials.accessToken === "function"
          ? await credentials.accessToken()
          : credentials.accessToken;

      auth.setCredentials({
        // get fresh access token if a function is provided
        access_token: accessToken,
      });
      return google.calendar({ version: "v3", auth });
    }

    // when not using access token its ok to use singleton instance
    if (this.calendar) {
      return this.calendar;
    }

    const auth = new google.auth.JWT(
      credentials?.clientEmail,
      credentials?.keyfile,
      credentials?.privateKey,
      scopes,
      credentials?.subject
    );

    this.calendar = google.calendar({ version: "v3", auth });
    return this.calendar;
  }

  async _call(input: string) {
    return input;
  }
}
