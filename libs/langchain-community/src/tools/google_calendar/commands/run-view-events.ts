import { calendar_v3 } from "googleapis";
import type { JWT } from "googleapis-common";
import { PromptTemplate } from "@langchain/core/prompts";
import { BaseLLM } from "@langchain/core/language_models/llms";
import { CallbackManagerForToolRun } from "@langchain/core/callbacks/manager";
import { StringOutputParser } from "@langchain/core/output_parsers";

import { VIEW_EVENTS_PROMPT } from "../prompts/index.js";
import { getTimezoneOffsetInHours } from "../utils/get-timezone-offset-in-hours.js";

import { RRuleSet } from "rrule-rust";
import { DateTime } from "luxon";

type RunViewEventParams = {
  calendarId: string;
  auth: JWT;
  model: BaseLLM;
};

type calendarItem = {
  status: string;
  summary: string;
  description?: string;
  recurrence?: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
};

const runViewEvents = async (
  query: string,
  { model, auth, calendarId }: RunViewEventParams,
  runManager?: CallbackManagerForToolRun
) => {
  const calendar = new calendar_v3.Calendar({});

  const prompt = new PromptTemplate({
    template: VIEW_EVENTS_PROMPT,
    inputVariables: ["date", "query", "u_timezone", "dayName"],
  });

  const viewEventsChain = prompt.pipe(model).pipe(new StringOutputParser());

  const date = new Date().toISOString();
  const u_timezone = getTimezoneOffsetInHours();
  const dayName = new Date().toLocaleString("en-us", { weekday: "long" });

  const output = await viewEventsChain.invoke(
    {
      query,
      date,
      u_timezone,
      dayName,
    },
    runManager?.getChild()
  );
  const loaded = JSON.parse(output);

  try {
    const response = await calendar.events.list({
      auth,
      calendarId,
      ...loaded,
    });

    const startFilter = DateTime.fromISO(loaded.time_min)
      .setZone(loaded.user_timezone)
      .toJSDate();
    const endFilter = DateTime.fromISO(loaded.time_max)
      .setZone(loaded.user_timezone)
      .toJSDate();

    const curatedItems: calendarItem[] = [];

    if (response.data && response.data.items) {
      const items = response.data.items as calendarItem[];

      for (const item of items) {
        if (item.recurrence) {
          const start = DateTime.fromISO(item.start.dateTime)
            .setZone(item.start.timeZone)
            .toJSDate();
          const end = DateTime.fromISO(item.end.dateTime)
            .setZone(item.end.timeZone)
            .toJSDate();
          const duration = end.getTime() - start.getTime();

          const startRruleSet = new RRuleSet(
            start.getTime(),
            item.start.timeZone
          ).toString();
          const fullRule = `${startRruleSet.toString()}${item.recurrence}`;
          const rruleSet = RRuleSet.parse(fullRule);
          const dates: calendarItem[] = rruleSet
            .between(startFilter.getTime(), endFilter.getTime())
            .map((d) => {
              return {
                status: item.status,
                summary: item.summary,
                description: item.description,
                start: {
                  dateTime: DateTime.fromMillis(d)
                    .setZone(item.start.timeZone)
                    .toISO(),
                  timeZone: item.start.timeZone,
                },
                end: {
                  dateTime: DateTime.fromMillis(d + duration)
                    .setZone(item.start.timeZone)
                    .toISO(),
                  timeZone: item.start.timeZone,
                },
              } as calendarItem;
            });

          curatedItems.push(...dates);
        } else {
          curatedItems.push({
            status: item.status,
            summary: item.summary,
            description: item.description,
            start: item.start,
            end: item.end,
          } as calendarItem);
        }
      }
    }

    return `Result for the prompt "${query}": \n${JSON.stringify(
      curatedItems.sort((a, b) => { return new Date(a.start.dateTime).getTime() - new Date(b.start.dateTime).getTime() }),
      null,
      2
    )}`;
  } catch (error) {
    return `An error occurred: ${error}`;
  }
};

export { runViewEvents };
