import { ConfluencePagesLoader } from "langchain/document_loaders/web/confluence";

const username = process.env.CONFLUENCE_USERNAME;
const accessToken = process.env.CONFLUENCE_ACCESS_TOKEN;

if (username && accessToken) {
  const loader = new ConfluencePagesLoader({
    baseUrl: "https://example.atlassian.net/wiki",
    spaceKey: "~EXAMPLE362906de5d343d49dcdbae5dEXAMPLE",
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
