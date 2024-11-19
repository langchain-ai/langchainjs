import { GoogleScholarAPI } from "@langchain/community/tools/google_scholar";

const scholar = new GoogleScholarAPI({
  apiKey: "YOUR_SERP_API_KEY", // Alternatively, set this as an environment variable.
});

(async () => {
  try {
    const query = "machine learning applications in healthcare";
    const results = await scholar._call(query);
    console.log("Search Results:", results);
  } catch (error) {
    console.error("Error querying Google Scholar via SerpApi:", error);
  }
})();
