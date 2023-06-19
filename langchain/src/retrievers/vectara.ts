import { Document } from "../document.js";
import { VectaraStore, VectaraFilter } from "../vectorstores/vectara.js";
import { BaseRetriever } from "../schema/index.js";

export class VectaraRetriever extends BaseRetriever {
  store: VectaraStore;
  
  constructor(store: VectaraStore) {
    super();
    this.store = store;
  }

  async getRelevantDocuments(
    query: string,
    k = 10,
    filter: VectaraFilter | undefined = undefined
  ): Promise<Document[]> {
    const res = await this.store.similaritySearch(query, k, filter);
    return res;
  }
}
