import { Callbacks } from "../callbacks/manager.js";
import { Document } from "../document.js";

/**
 * Base Index class. All indexes should extend this class.
 */
export abstract class BaseRetriever {
  abstract getRelevantDocuments(
    query: string,
    callbacks?: Callbacks
  ): Promise<Document[]>;
}
