import { SpiderLoader } from "@langchain/community/document_loaders/web/spider";

const loader = new SpiderLoader({
  url: "https://spider.cloud", // The URL to scrape
  apiKey: process.env.SPIDER_API_KEY, // Optional, defaults to `SPIDER_API_KEY` in your env.
  mode: "scrape", // The mode to run the crawler in. Can be "scrape" for single urls or "crawl" for deeper scraping following subpages
  // params: {
  //   // optional parameters based on Spider API docs
  //   // For API documentation, visit https://spider.cloud/docs/api
  // },
});

const docs = await loader.load();
