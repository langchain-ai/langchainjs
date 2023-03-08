# Notion Markdown Files

This example goes over how to load data from your Notion pages exported from the notion dashboard.

First, export your notion pages as **Markdown & CSV**as per the offical explanation [here](https://www.notion.so/help/export-your-content). Make sure to select `include subpages` and `Create folders for subpages.`

Then, unzip the downloaded file and move the unzipped folder into your repository. It should contain the markdown files of your pages. 

Once the folder is in your repository, simply run the example below:

```typescript
import { NotionLoader } from "langchain/document_loaders";

/** Provide the directory path of your notion folder */
const directoryPath = "Notion_DB"
const loader = new NotionLoader(directoryPath);
const docs = await loader.load();
console.log({ docs });
```