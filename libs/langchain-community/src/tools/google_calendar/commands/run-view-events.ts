import { calendar_v3 } from "googleapis";
import { PromptTemplate } from "@langchain/core/prompts";
import { BaseLanguageModel } from "@langchain/core/language_models/base";
import { CallbackManagerForToolRun } from "@langchain/core/callbacks/manager";
import { z } from "zod/v3";

import { VIEW_EVENTS_PROMPT } from "../prompts/index.js";
import { getTimezoneOffsetInHours } from "../utils/get-timezone-offset-in-hours.js";

const eventSchema = z.object({
  time_min: z.string(),
  time_max: z.string(),
  user_timezone: z.string(),
  max_results: z.number(),
  search_query: z.string().optional(),
});

type RunViewEventParams = {
  calendarId: string;
  calendar: calendar_v3.Calendar;
  model: BaseLanguageModel;
};

const runViewEvents = async (
  query: string,
  { model, calendar, calendarId }: RunViewEventParams,
  runManager?: CallbackManagerForToolRun
) => {
  const prompt = new PromptTemplate({
    template: VIEW_EVENTS_PROMPT,
    inputVariables: ["date", "query", "u_timezone", "dayName"],
  });

  if (!model?.withStructuredOutput) {
    throw new Error("Model does not support structured output");
  }

  const viewEventsChain = prompt.pipe(model.withStructuredOutput(eventSchema));

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

  try {
    const response = await calendar.events.list({
      calendarId,
      ...output,
    });

    const curatedItems =
      response.data && response.data.items
        ? response.data.items.map(
            ({
              status,
              summary,
              description,
              start,
              end,
            }: // eslint-disable-next-line @typescript-eslint/no-explicit-any
            any) => ({
              status,
              summary,
              description,
              start,
              end,
            })
          )
        : [];

    return `Result for the prompt "${query}": \n${JSON.stringify(
      curatedItems,
      null,
      2
    )}`;
  } catch (error) {
    return `An error occurred: ${error}`;
  }
};

export { runViewEvents };
