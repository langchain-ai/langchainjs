import { GoogleCalendarBase, GoogleCalendarAgentParams } from "./base.js";
import { VIEW_TOOL_DESCRIPTION } from "./descriptions.js";

import { runViewEvents } from "./commands/run-view-events.js";
import { CallbackManagerForToolRun } from "../../callbacks/manager.js";

/**
 * @example
 * ```typescript
 * const googleCalendarViewTool = new GoogleCalendarViewTool({
 *   credentials: {
 *     clientEmail: process.env.GOOGLE_CALENDAR_CLIENT_EMAIL,
 *     privateKey: process.env.GOOGLE_CALENDAR_PRIVATE_KEY,
 *     calendarId: process.env.GOOGLE_CALENDAR_CALENDAR_ID,
 *   },
 *   scopes: [
 *     "https:
 *     "https:
 *   ],
 *   model: new ChatOpenAI({}),
 * });
 * const viewInput = `What meetings do I have this week?`;
 * const viewResult = await googleCalendarViewTool.invoke({ input: viewInput });
 * console.log("View Result", viewResult);
 * ```
 */
export class GoogleCalendarViewTool extends GoogleCalendarBase {
  name = "google_calendar_view";

  description = VIEW_TOOL_DESCRIPTION;

  constructor(fields: GoogleCalendarAgentParams) {
    super(fields);
  }

  async _call(query: string, runManager?: CallbackManagerForToolRun) {
    const auth = await this.getAuth();
    const model = this.getModel();

    return runViewEvents(
      query,
      {
        auth,
        model,
        calendarId: this.calendarId,
      },
      runManager
    );
  }
}
