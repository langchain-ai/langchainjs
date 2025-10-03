import { TextLoader } from "@langchain/classic/document_loaders/fs/text";

const loader = new TextLoader("src/document_loaders/example_data/example.txt");
const docs = await loader.load();
