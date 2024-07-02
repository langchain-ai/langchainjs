/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { test } from "@jest/globals";
import { TaskadeProjectLoader } from "../web/taskade.js";

test.skip("Test TaskadeProjectLoader", async () => {
  const loader = new TaskadeProjectLoader({
    personalAccessToken: process.env.TASKADE_PERSONAL_ACCESS_TOKEN!,
    projectId: process.env.TASKADE_PROJECT_ID!,
  });
  const documents = await loader.load();
  console.log(documents[0].pageContent);
});
