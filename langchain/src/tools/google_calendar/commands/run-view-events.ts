import { calendar_v3 } from "googleapis";
import type { JWT } from "googleapis-common";
import { PromptTemplate } from "../../../prompts/index.js";
import { LLMChain } from "../../../chains/index.js";
import { VIEW_EVENTS_PROMPT } from "../prompts/index.js";
import { getTimezoneOffsetInHours } from "../utils/get-timezone-offset-in-hours.js";
import { BaseLLM } from "../../../llms/base.js";
import { CallbackManagerForToolRun } from "../../../callbacks/manager.js";

type RunViewEventParams = {
  calendarId: string;
  auth: JWT;
  model: BaseLLM;
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

  const viewEventsChain = new LLMChain({
    llm: model,
    prompt,
  });

  const date = new Date().toISOString();
  const u_timezone = getTimezoneOffsetInHours();
  const dayName = new Date().toLocaleString("en-us", { weekday: "long" });

  const output = await viewEventsChain.call(
    {
      query,
      date,
      u_timezone,
      dayName,
    },
    runManager?.getChild()
  );
  const loaded = JSON.parse(output.text);

  try {
    const response = await calendar.events.list({
      auth,
      calendarId,
      ...loaded,
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
