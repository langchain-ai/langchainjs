import { GoogleCalendarBase, GoogleCalendarAgentParams } from "./base.js";
import { VIEW_TOOL_DESCRIPTION } from "./descriptions.js";

import { runViewEvents } from "./commands/run-view-events.js";
import { CallbackManagerForToolRun } from "../../callbacks/manager.js";

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
