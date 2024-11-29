import { JiraProjectLoader } from "@langchain/community/document_loaders/web/jira";

const host = process.env.JIRA_HOST;
const username = process.env.JIRA_USERNAME;
const accessToken = process.env.JIRA_ACCESS_TOKEN;
const projectKey = process.env.JIRA_PROJECT_KEY;

if (username && accessToken) {
  const loader = new JiraProjectLoader({
    host,
    projectKey,
    username,
    accessToken,
  });

  const documents = await loader.load();
  console.log(documents);
} else {
  console.log(
    "You must provide a username and access token to run this example."
  );
}
