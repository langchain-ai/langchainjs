import { BaseRetriever } from "../../../schema/retriever.js";
import { DynamicTool, DynamicToolInput } from "../../../tools/dynamic.js";

export function createRetrieverTool(
  retriever: BaseRetriever,
  input: Omit<DynamicToolInput, "func">
) {
  const func = async (input: string) => {
    const docs = await retriever.getRelevantDocuments(input);
    return docs.map((doc) => doc.pageContent).join("\n");
  };
  return new DynamicTool({ ...input, func });
}
