import { JiraProjectLoader } from "@langchain/community/document_loaders/web/jira";

const host = process.env.JIRA_HOST || "https://jira.example.com";
const username = process.env.JIRA_USERNAME;
const accessToken = process.env.JIRA_ACCESS_TOKEN;
const projectKey = process.env.JIRA_PROJECT_KEY || "PROJ";

if (username && accessToken) {
  // Created within last 30 days
  const createdAfter = new Date();
  createdAfter.setDate(createdAfter.getDate() - 30);
  const loader = new JiraProjectLoader({
    host,
    projectKey,
    username,
    accessToken,
    createdAfter,
  });

  const documents = await loader.load();
  console.log(`Loaded ${documents.length} Jira document(s)`);
} else {
  console.log(
    "You must provide a username and access token to run this example."
  );
}
