import { SERPGoogleScholarAPITool } from "@langchain/community/tools/google_scholar";

const scholar = new SERPGoogleScholarAPITool({
  apiKey: process.env.SERPAPI_API_KEY,
});

(async () => {
  try {
    const query = "Attention is all we need";
    const results = await scholar.invoke(query);
    console.log("Search Results:", results);
  } catch (error) {
    console.error("Error querying Google Scholar via SerpApi:", error);
  }
})();
