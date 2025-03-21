class StrategyMixin {
  operator: string;

  searchFunction: string;

  indexFunction: string;

  constructor(operator: string, searchFunction: string, indexFunction: string) {
    this.operator = operator;
    this.searchFunction = searchFunction;
    this.indexFunction = indexFunction;
  }
}

/**
 * Enumerator of the Distance strategies.
 */
export class DistanceStrategy extends StrategyMixin {
  public static EUCLIDEAN = new StrategyMixin(
    "<->",
    "l2_distance",
    "vector_l2_ops"
  );

  public static COSINE_DISTANCE = new StrategyMixin(
    "<=>",
    "cosine_distance",
    "vector_cosine_ops"
  );

  public static INNER_PRODUCT = new StrategyMixin(
    "<#>",
    "inner_product",
    "vector_ip_ops"
  );
}

export const DEFAULT_DISTANCE_STRATEGY = DistanceStrategy.COSINE_DISTANCE;
export const DEFAULT_INDEX_NAME_SUFFIX: string = "langchainvectorindex";

/**
 * Convert index attributes to string.
 * Must be implemented by subclasses.
 */
export abstract class QueryOptions {
  abstract to_string(): string;
}
