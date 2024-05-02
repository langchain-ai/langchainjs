import { OpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { RetrievalQAChain } from "langchain/chains";
import { HNSWLib } from "@langchain/community/vectorstores/hnswlib";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import * as fs from "fs";

// Initialize the LLM to use to answer the question.
const model = new OpenAI({});
const text = fs.readFileSync("state_of_the_union.txt", "utf8");
const textSplitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000 });
const docs = await textSplitter.createDocuments([text]);

// Create a vector store from the documents.
const vectorStore = await HNSWLib.fromDocuments(docs, new OpenAIEmbeddings());

// Create a chain that uses a map reduce chain and HNSWLib vector store.
const chain = RetrievalQAChain.fromLLM(model, vectorStore.asRetriever(), {
  returnSourceDocuments: true, // Can also be passed into the constructor
});
const res = await chain.invoke({
  query: "What did the president say about Justice Breyer?",
});
console.log(JSON.stringify(res, null, 2));
/*
{
  "text": " The president thanked Justice Breyer for his service and asked him to stand so he could be seen.",
  "sourceDocuments": [
    {
      "pageContent": "Justice Breyer, thank you for your service. Thank you, thank you, thank you. I mean it. Get up. Stand — let me see you. Thank you.\n\nAnd we all know — no matter what your ideology, we all know one of the most serious constitutional responsibilities a President has is nominating someone to serve on the United States Supreme Court.\n\nAs I did four days ago, I’ve nominated a Circuit Court of Appeals — Ketanji Brown Jackson. One of our nation’s top legal minds who will continue in just Brey- — Justice Breyer’s legacy of excellence. A former top litigator in private practice, a former federal public defender from a family of public-school educators and police officers — she’s a consensus builder.\n\nSince she’s been nominated, she’s received a broad range of support, including the Fraternal Order of Police and former judges appointed by Democrats and Republicans.",
      "metadata": {
        "loc": {
          "lines": {
            "from": 481,
            "to": 487
          }
        }
      }
    },
    {
      "pageContent": "Since she’s been nominated, she’s received a broad range of support, including the Fraternal Order of Police and former judges appointed by Democrats and Republicans.\n\nJudge Ketanji Brown Jackson\nPresident Biden's Unity AgendaLearn More\nSince she’s been nominated, she’s received a broad range of support, including the Fraternal Order of Police and former judges appointed by Democrats and Republicans.\n\nFolks, if we are to advance liberty and justice, we need to secure our border and fix the immigration system.\n\nAnd as you might guess, I think we can do both. At our border, we’ve installed new technology, like cutting-edge scanners, to better detect drug smuggling.\n\nWe’ve set up joint patrols with Mexico and Guatemala to catch more human traffickers.\n\nWe’re putting in place dedicated immigration judges in significant larger number so families fleeing persecution and violence can have their cases — cases heard faster — and those who aren’t legitimately here can be sent back.",
      "metadata": {
        "loc": {
          "lines": {
            "from": 487,
            "to": 499
          }
        }
      }
    },
    {
      "pageContent": "These laws don’t infringe on the Second Amendment; they save lives.\n\nGun Violence\n\n\nThe most fundamental right in America is the right to vote and have it counted. And look, it’s under assault.\n\nIn state after state, new laws have been passed not only to suppress the vote — we’ve been there before — but to subvert the entire election. We can’t let this happen.\n\nTonight, I call on the Senate to pass — pass the Freedom to Vote Act. Pass the John Lewis Act — Voting Rights Act. And while you’re at it, pass the DISCLOSE Act so Americans know who is funding our elections.\n\nLook, tonight, I’d — I’d like to honor someone who has dedicated his life to serve this country: Justice Breyer — an Army veteran, Constitutional scholar, retiring Justice of the United States Supreme Court.\n\nJustice Breyer, thank you for your service. Thank you, thank you, thank you. I mean it. Get up. Stand — let me see you. Thank you.",
      "metadata": {
        "loc": {
          "lines": {
            "from": 468,
            "to": 481
          }
        }
      }
    },
    {
      "pageContent": "If you want to go forward not backwards, we must protect access to healthcare; preserve a woman’s right to choose — and continue to advance maternal healthcare for all Americans.\n\nRoe v. Wade\n\n\nAnd folks, for our LGBTQ+ Americans, let’s finally get the bipartisan Equality Act to my desk. The onslaught of state laws targeting transgender Americans and their families — it’s simply wrong.\n\nAs I said last year, especially to our younger transgender Americans, I’ll always have your back as your President so you can be yourself and reach your God-given potential.\n\nBipartisan Equality Act\n\n\nFolks as I’ve just demonstrated, while it often appears we do not agree and that — we — we do agree on a lot more things than we acknowledge.",
      "metadata": {
        "loc": {
          "lines": {
            "from": 511,
            "to": 523
          }
        }
      }
    }
  ]
}
*/
