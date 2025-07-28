import * as fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PolarisAIDataInsightLoader } from "@langchain/community/document_loaders/web/polaris_ai_datainsight";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const apiKey = process.env.POLARIS_AI_DATA_INSIGHT_API_KEY;

async function main() {
  const filePath = path.join(
    __dirname,
    "./example_data/polaris_ai_datainsight/example.docx"
  );
  const file = fs.readFileSync(filePath);

  const loader = new PolarisAIDataInsightLoader({
    apiKey,
    file,
    filename: "example.docx",
  });

  const docs = await loader.load();
  console.log(docs);
}

main().catch(console.error);
