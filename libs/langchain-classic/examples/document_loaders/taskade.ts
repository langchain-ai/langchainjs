import { TaskadeProjectLoader } from "@langchain/community/document_loaders/web/taskade";

const loader = new TaskadeProjectLoader({
  personalAccessToken: "TASKADE_PERSONAL_ACCESS_TOKEN", // or load it from process.env.TASKADE_PERSONAL_ACCESS_TOKEN
  projectId: "projectId",
});
const docs = await loader.load();

console.log({ docs });
