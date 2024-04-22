import { FireCrawlLoader } from "langchain/document_loaders/web/firecrawl";

const loader = new FireCrawlLoader({
    url: "https://firecrawl.dev", // The URL to scrape
    apiKey: process.env.FIRECRAWL_API_KEY, //  This will be loaded from your .env too
    mode: "scrape", // The mode to run the crawler in. Can be "scrape" for single urls or "crawl" for all accessible subpages
    params: {
        // optional parameters based on Firecrawl API docs
        // For API documentation, visit https://docs.firecrawl.dev
    }
  });

const docs = await loader.load();