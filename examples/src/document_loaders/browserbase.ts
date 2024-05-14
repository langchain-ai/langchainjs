import { BrowserbaseLoader } from "langchain/document_loaders/web/browserbase";

const loader = new BrowserbaseLoader(["https://example.com"], {
  textContent: true,
});
const docs = await loader.load();
