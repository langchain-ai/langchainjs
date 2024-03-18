import hanaClient from '@sap/hana-client';
import { HanaDB, HanaDBArgs} from "@langchain/community/vectorstores/hanavector";
import { Document } from "@langchain/core/documents";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { CharacterTextSplitter } from "langchain/text_splitter";
import { OpenAIEmbeddings } from "@langchain/openai";

// Connection parameters
const connectionParams = {
    host : process.env.HOST,   
    port : process.env.PORT,   
    uid  : process.env.UID,        
    pwd  : process.env.PWD
  };
  
const embeddings = new OpenAIEmbeddings();
//connet to hanaDB
const client = hanaClient.createConnection();
client.connect(connectionParams);
const args: HanaDBArgs = {
    connection: client,
    tableName: "test_fromDocs",
    };
// Load documents from file
const loader = new TextLoader("./state_of_the_union.txt");
const rawDocuments = await loader.load();
const splitter = new CharacterTextSplitter({
  chunkSize: 500,
  chunkOverlap: 0
});
const documents = await splitter.splitDocuments(rawDocuments);
const vectorStore = await HanaDB.fromDocuments(documents, embeddings, args);

