import { BaseRetriever, type BaseRetrieverInput } from "@langchain/core/retrievers";
import type { CallbackManagerForRetrieverRun } from "@langchain/core/callbacks/manager";
import { Document, DocumentInterface } from "@langchain/core/documents";
import { OpenFgaClient, ClientCheckRequest } from "@openfga/sdk";

type FGARetrieverArgs = {
    user: string;
    retriever: BaseRetriever;
    fgaClient: OpenFgaClient;
    fields?: BaseRetrieverInput;
    checkFromDocument: (user: string, doc: DocumentInterface<Record<string, any>>, query: string) => ClientCheckRequest;
}

export class FGARetriever extends BaseRetriever {
    static lc_name() {
        return "FGARetriever";
    }

    lc_namespace = ["langchain", "retrievers", "fga"];
    private retriever: BaseRetriever;
    private checkFromDocument: (user: string, doc: DocumentInterface<Record<string, any>>, query: string) => ClientCheckRequest;
    private user: string;
    private fgaClient: OpenFgaClient;

    constructor({ user, retriever, fgaClient, fields, checkFromDocument }: FGARetrieverArgs) {
        super(fields);
        this.user = user;
        this.fgaClient = fgaClient;
        this.retriever = retriever;
        this.checkFromDocument = checkFromDocument;
    }

    private async accessByDocument(checks: ClientCheckRequest[]): Promise<Map<string, boolean>> {
        const results = await this.fgaClient.batchCheck(checks);
        return results.responses.reduce((c: Map<string, boolean>, v) => {
            c.set(v._request.object, v.allowed || false);
            return c;
        }, new Map<string, boolean>());
    }

    async _getRelevantDocuments(
      query: string,
      runManager?: CallbackManagerForRetrieverRun
    ): Promise<Document[]> {
        const documents = await this.retriever._getRelevantDocuments(query, runManager);
        const out = documents.reduce((out, doc) => { 
            const check = this.checkFromDocument(this.user, doc, query);
            out.checks.push(check);
            out.documentToObject.set(doc, check.object);
            return out;
        }, { checks: [] as ClientCheckRequest[], documentToObject: new Map<DocumentInterface<Record<string, any>>, string>() });
        const { checks, documentToObject } = out;
        const resultsByObject = await this.accessByDocument(checks);

        return documents.filter((d, _) => resultsByObject.get(documentToObject.get(d) || '') === true);
    }
  }