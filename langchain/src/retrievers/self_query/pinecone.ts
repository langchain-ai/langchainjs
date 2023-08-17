import { Comparators, Operators } from "../../chains/query_constructor/ir.js";
import { PineconeStore } from "../../vectorstores/pinecone.js";
import { BasicTranslator } from "./base.js";

export class PineconeTranslator<
  T extends PineconeStore
> extends BasicTranslator<T> {
  constructor() {
    super({
      allowedOperators: [Operators.and, Operators.or],
      allowedComparators: [
        Comparators.eq,
        Comparators.ne,
        Comparators.gt,
        Comparators.gte,
        Comparators.lt,
        Comparators.lte,
      ],
    });
  }
}
