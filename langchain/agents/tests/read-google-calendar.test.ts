import { ReadGoogleCalendar } from "../tools/read-google-calendar";
import { authenticate } from "@google-cloud/local-auth";

import { test, expect } from "@jest/globals";

test("Read Google Calendar", async () => {
  const authClient = await authenticate({
    scopes: ["https://www.googleapis.com/auth/calendar.readonly"],
    keyfilePath: process.env.GOOGLE_KEYFILE_PATH ?? "",
  });
  const gcal = new ReadGoogleCalendar({ auth: authClient, version: "v3" });
  const res = await gcal.call();
  console.log(res);
  expect(true).toBe(true);
});
