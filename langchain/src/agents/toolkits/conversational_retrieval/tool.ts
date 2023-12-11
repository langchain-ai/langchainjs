import { z } from "zod";
import { CallbackManagerForToolRun } from "../../../callbacks/manager.js";
import { BaseRetriever } from "../../../schema/retriever.js";
import {
  DynamicStructuredTool,
  DynamicStructuredToolInput,
} from "../../../tools/dynamic.js";
import { formatDocumentsAsString } from "../../../util/document.js";

export function createRetrieverTool(
  retriever: BaseRetriever,
  input: Omit<DynamicStructuredToolInput, "func" | "schema">
) {
  const func = async (
    { input }: { input: string },
    runManager?: CallbackManagerForToolRun
  ) => {
    const docs = await retriever.getRelevantDocuments(
      input,
      runManager?.getChild("retriever")
    );
    return formatDocumentsAsString(docs);
  };
  const schema = z.object({
    input: z
      .string()
      .describe("Natural language query used as input to the retriever"),
  });
  return new DynamicStructuredTool({ ...input, func, schema });
}
