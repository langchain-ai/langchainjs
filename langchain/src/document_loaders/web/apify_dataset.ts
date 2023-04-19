import { Document } from "../../document.js";
import { BaseDocumentLoader, DocumentLoader } from "../base.js";

export class ApifyDatasetLoader
  extends BaseDocumentLoader
  implements DocumentLoader
{
  protected datasetId: string;

  protected datasetMappingFunction: (
    item: Record<string | number, unknown>
  ) => Document;

  constructor(
    datasetId: string,
    datasetMappingFunction: (item: Record<string | number, unknown>) => Document
  ) {
    super();
    this.datasetId = datasetId;
    this.datasetMappingFunction = datasetMappingFunction;
  }

  static async imports(): Promise<{
    ApifyClientClass: typeof import("apify-client").ApifyClient;
  }> {
    try {
      const { ApifyClient } = await import("apify-client");
      return { ApifyClientClass: ApifyClient };
    } catch (e) {
      throw new Error(
        "Please install apify-client as a dependency with, e.g. `yarn add apify-client`"
      );
    }
  }

  async load(): Promise<Document[]> {
    const { ApifyClientClass } = await ApifyDatasetLoader.imports();
    const apifyClient = new ApifyClientClass();

    const datasetItems = (
      await apifyClient.dataset(this.datasetId).listItems({ clean: true })
    ).items;
    return datasetItems.map(this.datasetMappingFunction);
  }
}
