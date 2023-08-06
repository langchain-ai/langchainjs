import { Comparators, Operators } from "../../chains/query_constructor/ir.js";
import { BasicTranslator } from "./base.js";

export class ChromaTranslator extends BasicTranslator {
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
