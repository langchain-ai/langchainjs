import {BaseRetriever, BaseRetrieverInput} from '@langchain/core/retrievers';
import {Document} from '@langchain/core/documents';
import {CallbackManagerForRetrieverRun} from '@langchain/core/callbacks/manager';

export interface MultiRetrieverInput extends BaseRetrieverInput {
  retrivers: BaseRetriever[];
}

export class MultiRetriever extends BaseRetriever {
  static lc_name() {
    return 'MergeRetriever';
  }

  lc_namespace = ['langchain', 'retrievers', 'multi_retriever'];

  retrievers: BaseRetriever[];

  constructor(args: MultiRetrieverInput) {
    super(args);
    this.retrievers = args.retrivers;
  }

  async _getRelevantDocuments(query: string, runManager?: CallbackManagerForRetrieverRun) {
    return this._merge_documents(query, runManager);
  }

  async _merge_documents(query: string, runManager?: CallbackManagerForRetrieverRun): Promise<Document[]> {
    const retriever_docs = [];
    for (const retriver of this.retrievers) {
      const res = await retriver.invoke(query, {
        callbacks: runManager?.getChild(),
      });
      retriever_docs.push(res);
    }

    const merged_docs = [];
    let max_doc_length = 0;
    for (const docs of retriever_docs) {
      if (docs.length > max_doc_length) {
        max_doc_length = docs.length;
      }
    }

    for (let docIndex = 0; docIndex < max_doc_length; docIndex += 1) {
      for (const docs of retriever_docs) {
        if (docs.length > docIndex) {
          merged_docs.push(docs[docIndex]);
        } else {
          continue;
        }
      }
    }

    return merged_docs;
  }
}