import { expect, browser, $ } from "@wdio/globals";

const WHITELISTED_LOGS = ["[vite] connect", "Download the React DevTools"];

describe("Langchain Google E2E", () => {
  let logMessages: string[] = [];

  before(async () => {
    await browser.sessionSubscribe({ events: ["log.entryAdded"] });
    browser.on("log.entryAdded", (entryAdded) => {
      const message = entryAdded.text || entryAdded.type;

      /**
       * If the message is not whitelisted, add it to the log messages
       */
      if (!WHITELISTED_LOGS.find((log) => message.includes(log))) {
        logMessages.push(message);
      }
    });
  });

  it("should generate a response", async () => {
    await browser.url(`/`);

    await $("#prompt").setValue("What is the capital of France?");
    await $('button[type="submit"]').click();

    await expect($(".response")).toHaveText(expect.stringContaining("Paris"));
  });

  it("no logs should be present", async () => {
    expect(logMessages).toEqual([]);
  });
});
