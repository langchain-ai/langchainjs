/* #__PURE__ */ console.error(
  "[WARN] Importing from 'langchain/document_loaders' is deprecated. Import from eg. 'langchain/document_loaders/fs/text' or 'langchain/document_loaders/web/cheerio' instead. See https://js.langchain.com/docs/getting-started/install#updating-from-0052 for upgrade instructions."
);

export type { DocumentLoader } from "./base.js";
export { BaseDocumentLoader } from "./base.js";
export { CheerioWebBaseLoader } from "./web/cheerio.js";
export { PuppeteerWebBaseLoader, PuppeteerEvaluate } from "./web/puppeteer.js";
export { CollegeConfidentialLoader } from "./web/college_confidential.js";
export { GitbookLoader } from "./web/gitbook.js";
export { HNLoader } from "./web/hn.js";
export { IMSDBLoader } from "./web/imsdb.js";
export { ApifyDatasetLoader } from "./web/apify_dataset.js";
export { DirectoryLoader, UnknownHandling } from "./fs/directory.js";
export { SRTLoader } from "./fs/srt.js";
export { PDFLoader } from "./fs/pdf.js";
export { DocxLoader } from "./fs/docx.js";
export { EPubLoader } from "./fs/epub.js";
export { TextLoader } from "./fs/text.js";
export { JSONLoader, JSONLinesLoader } from "./fs/json.js";
export { CSVLoader } from "./fs/csv.js";
export { NotionLoader } from "./fs/notion.js";
export { GithubRepoLoader, GithubRepoLoaderParams } from "./web/github.js";
export { UnstructuredLoader } from "./fs/unstructured.js";
