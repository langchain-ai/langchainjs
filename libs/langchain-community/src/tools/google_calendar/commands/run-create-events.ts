import { z } from "zod/v3";
import { calendar_v3 } from "googleapis";
import type { GaxiosResponse } from "googleapis-common";
import { PromptTemplate } from "@langchain/core/prompts";
import { CallbackManagerForToolRun } from "@langchain/core/callbacks/manager";
import { BaseLanguageModel } from "@langchain/core/language_models/base";
import { CREATE_EVENT_PROMPT } from "../prompts/index.js";
import { getTimezoneOffsetInHours } from "../utils/get-timezone-offset-in-hours.js";

const eventSchema = z.object({
  event_summary: z.string(),
  event_start_time: z.string(),
  event_end_time: z.string(),
  event_location: z.string().optional(),
  event_description: z.string().optional(),
  user_timezone: z.string(),
});

type CreateEventParams = {
  eventSummary: string;
  eventStartTime: string;
  eventEndTime: string;
  userTimezone: string;
  eventLocation?: string;
  eventDescription?: string;
};

const createEvent = async (
  {
    eventSummary,
    eventStartTime,
    eventEndTime,
    userTimezone,
    eventLocation = "",
    eventDescription = "",
  }: CreateEventParams,
  calendarId: string,
  calendar: calendar_v3.Calendar
) => {
  const event = {
    summary: eventSummary,
    location: eventLocation,
    description: eventDescription,
    start: {
      dateTime: eventStartTime,
      timeZone: userTimezone,
    },
    end: {
      dateTime: eventEndTime,
      timeZone: userTimezone,
    },
  };

  try {
    const createdEvent = await calendar.events.insert({
      calendarId,
      requestBody: event,
    });

    return createdEvent;
  } catch (error) {
    return {
      error: `An error occurred: ${error}`,
    };
  }
};

type RunCreateEventParams = {
  calendarId: string;
  calendar: calendar_v3.Calendar;
  model: BaseLanguageModel;
};

const runCreateEvent = async (
  query: string,
  { calendarId, calendar, model }: RunCreateEventParams,
  runManager?: CallbackManagerForToolRun
) => {
  const prompt = new PromptTemplate({
    template: CREATE_EVENT_PROMPT,
    inputVariables: ["date", "query", "u_timezone", "dayName"],
  });
  if (!model?.withStructuredOutput) {
    throw new Error("Model does not support structured output");
  }
  const createEventChain = prompt.pipe(model.withStructuredOutput(eventSchema));

  const date = new Date().toISOString();
  const u_timezone = getTimezoneOffsetInHours();
  const dayName = new Date().toLocaleString("en-us", { weekday: "long" });

  const output = await createEventChain.invoke(
    {
      query,
      date,
      u_timezone,
      dayName,
    },
    runManager?.getChild()
  );

  const [
    eventSummary,
    eventStartTime,
    eventEndTime,
    eventLocation,
    eventDescription,
    userTimezone,
  ] = Object.values(output);

  const event = await createEvent(
    {
      eventSummary,
      eventStartTime,
      eventEndTime,
      userTimezone,
      eventLocation,
      eventDescription,
    } as CreateEventParams,
    calendarId,
    calendar
  );

  if (!(event as { error: string }).error) {
    return `Event created successfully, details: event ${
      (event as GaxiosResponse<calendar_v3.Schema$Event>).data.htmlLink
    }`;
  }

  return `An error occurred creating the event: ${
    (event as { error: string }).error
  }`;
};

export { runCreateEvent };
