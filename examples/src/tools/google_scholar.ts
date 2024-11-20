import { GoogleScholarAPI } from "../../../libs/langchain-community/src/tools/google_scholar.js";

const scholar = new GoogleScholarAPI({
  apiKey: "567433bea61f9193deb1a44f2851537658f29ef4135a1fe3eadabc9390dd4d6e", // Alternatively, set this as an environment variable.
});

(async () => {
  try {
    const query = "Machine Learning";
    const results = await scholar._call(query);
    console.log("Search Results:", results);
  } catch (error) {
    console.error("Error querying Google Scholar via SerpApi:", error);
  }
})();