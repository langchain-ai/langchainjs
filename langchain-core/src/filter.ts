/**
 * A flexible, runtime-based metadata filtering system that creates
 * platform-independent filter expressions. This generative approach
 * allows defining search filters that can be later translated into
 * specific vector database query languages.
 *
 * Supports standard comparison operations like:
 * - Equality and inequality (==, !=)
 * - Numeric comparisons (<, <=, >, >=)
 * - Inclusion and exclusion checks (IN/NOT IN)
 * - Logical combinations using AND and OR operators
 */

/**
 * Comprehensive metadata filtering expression operations:
 *
 * Comparison Operations:
 * - Supports exact matching (Equal) and inequality comparisons
 * - Includes comparison types:
 *   - Greater Than (GT)
 *   - Greater Than or Equal (GTE)
 *   - Less Than (LT)
 *   - Less Than or Equal (LTE)
 * - These operations follow the pattern: "Key Operator Value"
 *
 * Logical Combination Operations:
 * - AND and OR operators for combining multiple filter expressions
 * - Can combine individual expressions or grouped expressions
 * - Allows complex nested filtering logic
 *
 * Collection Membership Checks:
 * - IN operator: Checks if a value is present in a collection
 * - NOT IN (NIN) operator: Checks if a value is absent from a collection
 * - Supports checking key membership against an array of values
 */
// test
export const enum Operator {
  AND,
  OR,
  EQ,
  NE,
  GT,
  GTE,
  LT,
  LTE,
  IN,
  NIN,
  NOT,
}

export type Operand = Key | Value | Expression | Group;

export class Key {
  constructor(public key: string) {}
}

export class Value {
  constructor(
    public value: number | string | boolean | number[] | string[] | boolean[]
  ) {}
}

/**
 * Represents a boolean filter expression with a specific structure:
 * - Consists of a left operand, an operator, and an optional right operand
 * - Enables construction of complex filtering logic using different types of comparisons
 *
 * The expression follows the pattern: `left operator right`
 * (Note: Some operators may only require a left operand)
 */
export class Expression {
  constructor(
    public type: Operator,
    public left: Operand,
    public right?: Operand
  ) {}
}

/**
 * Represents a grouped collection of filter expressions that should be evaluated together
 * - Enables creating complex, nested filtering logic with specific evaluation precedence
 * - Analogous to parentheses in mathematical or logical expressions
 * - Allows nested or complex filtering conditions to be treated as a single logical unit
 */
export class Group {
  constructor(public content: Expression) {}
}

/**
 * Fluent builder for creating flexible and composable filter expressions
 *
 * Purpose:
 * - Provides an intuitive, method-chaining approach to constructing complex filter conditions
 * - Supports various comparison and logical operations for metadata filtering
 *
 * Features:
 * - Equality and inequality checks
 * - Numeric comparisons (greater than, less than, etc.)
 * - Logical combinations (AND, OR, NOT)
 * - Collection membership tests (IN, NOT IN)
 * - Expression grouping for complex nested conditions
 *
 * Examples:
 * ```typescript
 * // Simple equality filter
 * const catGenreFilter = b.eq('genre', 'cat');
 *
 * // Complex compound filter
 * const advancedFilter = b.and(
 *   b.eq('genre', 'dog'),
 *   b.gte('birth', 2023)
 * );
 * // Translates to: (genre == "dog") AND (birth >= 2023)
 * ```
 */
export class FilterExpressionBuilder {
  eq(
    key: string,
    value: number | string | boolean | number[] | string[] | boolean[]
  ): Expression {
    return new Expression(
      Operator.EQ,
      new Key(key),
      value ? new Value(value) : undefined
    );
  }

  ne(
    key: string,
    value: number | string | boolean | number[] | string[] | boolean[]
  ): Expression {
    return new Expression(
      Operator.NE,
      new Key(key),
      value ? new Value(value) : undefined
    );
  }

  gt(key: string, value: number | string): Expression {
    return new Expression(
      Operator.GT,
      new Key(key),
      value ? new Value(value) : undefined
    );
  }

  gte(key: string, value: number | string): Expression {
    return new Expression(
      Operator.GTE,
      new Key(key),
      value ? new Value(value) : undefined
    );
  }

  lt(key: string, value: number | string): Expression {
    return new Expression(
      Operator.LT,
      new Key(key),
      value ? new Value(value) : undefined
    );
  }

  lte(key: string, value: number | string): Expression {
    return new Expression(
      Operator.LTE,
      new Key(key),
      value ? new Value(value) : undefined
    );
  }

  and(left: Operand, right: Operand): Expression {
    return new Expression(Operator.AND, left, right);
  }

  or(left: Operand, right: Operand): Expression {
    return new Expression(Operator.OR, left, right);
  }

  in(key: string, values: number[] | string[] | boolean[]): Expression {
    return new Expression(
      Operator.IN,
      new Key(key),
      values ? new Value(values) : undefined
    );
  }

  nin(key: string, values: number[] | string[] | boolean[]): Expression {
    return new Expression(
      Operator.NIN,
      new Key(key),
      values ? new Value(values) : undefined
    );
  }

  group(content: Expression): Group {
    return new Group(content);
  }

  not(content: Expression): Expression {
    return new Expression(Operator.NOT, content);
  }
}

/**
 * Simple StringBuilder
 */
export class StringBuilder {
  buffer: string[] = [];

  append(str: string): void {
    this.buffer.push(str);
  }

  toString(): string {
    return this.buffer.join("");
  }
}

/**
 * Defines a contract for converting filter expressions into various string-based query representations
 *
 * Purpose:
 * - Provides a flexible mechanism for translating abstract filter expressions
 * - Supports conversion of complex filter logic across different query languages or databases
 *
 * Key Conversion Methods:
 * - Transform expressions, operands, keys, values into string representations
 * - Handle nested expressions and grouped conditions
 * - Support range and list value conversions
 */
export interface FilterExpressionConverter {
  /**
   * Converts a complete expression into its string representation
   * @param expression The filter expression to convert
   * @returns A string query representation of the expression
   */
  convertExpression(expression: Expression): string;

  /**
   * Determines the appropriate operation symbol for a given expression
   * @param exp The expression to analyze
   * @param context The string builder to append the representation
   */
  convertSymbolToContext(exp: Expression, context: StringBuilder): void;

  /**
   * Converts an operand into a string representation within a given context
   * @param operand The operand to convert (Key, Value, Expression, or Group)
   * @param context The string builder to append the representation
   */
  convertOperandToContext(
    operand: Key | Value | Expression | Group,
    context: StringBuilder
  ): void;

  // Additional conversion methods for specific components...
  convertExpressionToContext(expression: Expression, context: StringBuilder): void;
  convertKeyToContext(filterKey: Key, context: StringBuilder): void;
  convertValueToContext(filterValue: Value, context: StringBuilder): void;
  convertSingleValueToContext(
    value: number | string | boolean | number[] | string[] | boolean[],
    context: StringBuilder
  ): void;

  // Group and range handling methods
  writeGroupStart(group: Group, context: StringBuilder): void;
  writeGroupEnd(group: Group, context: StringBuilder): void;
  writeValueRangeStart(listValue: Value, context: StringBuilder): void;
  writeValueRangeEnd(listValue: Value, context: StringBuilder): void;
  writeValueRangeSeparator(listValue: Value, context: StringBuilder): void;
}

// Define the negation map
const TYPE_NEGATION_MAP: Record<Operator, Operator> = {
  [Operator.AND]: Operator.OR,
  [Operator.OR]: Operator.AND,
  [Operator.EQ]: Operator.NE,
  [Operator.NE]: Operator.EQ,
  [Operator.GT]: Operator.LTE,
  [Operator.GTE]: Operator.LT,
  [Operator.LT]: Operator.GTE,
  [Operator.LTE]: Operator.GT,
  [Operator.IN]: Operator.NIN,
  [Operator.NIN]: Operator.IN,
  [Operator.NOT]: Operator.NOT,
};

/**
 * Abstract base class for converting filter expressions into string representations
 *
 * Purpose:
 * - Provides a flexible, extensible framework for converting complex filter expressions
 * - Defines a standard conversion process with pluggable implementation details
 *
 * Key Features:
 * - Supports conversion of various operand types (Keys, Values, Expressions, Groups)
 * - Handles different operator types and conversion strategies
 * - Provides default implementations with extensible methods
 */
export class BaseFilterExpressionConverter {
  /**
   * Transforms a filter expression into a string
   * @param expression The filter condition to convert
   * @returns A string version of the expression
   */
  convertExpression(expression: Expression): string {
    return this.convertOperand(expression);
  }

  /**
   * Converts an operand to a string using a StringBuilder
   * @param operand The filter component to convert
   * @returns The string representation of the operand
   */
  private convertOperand(operand: Operand): string {
    const context = new StringBuilder();
    this.convertOperandToContext(operand, context);
    return context.toString();
  }

  /**
   * Provides standard symbols for different logical and comparison operators
   * @param exp The expression to get a symbol for
   * @returns The corresponding operator symbol
   */
  convertSymbolToContext(exp: Expression, context: StringBuilder): void {
    const symbolMap = {
      [Operator.AND]: " AND ",
      [Operator.OR]: " OR ",
      [Operator.EQ]: " = ",
      [Operator.NE]: " != ",
      [Operator.LT]: " < ",
      [Operator.LTE]: " <= ",
      [Operator.GT]: " > ",
      [Operator.GTE]: " >= ",
      [Operator.IN]: " IN ",
      [Operator.NOT]: " NOT IN ",
      [Operator.NIN]: " NOT IN ",
    };
    context.append(
      symbolMap[exp.type] ||
      (() => {
        throw new Error(`Unsupported expression type: ${exp.type}`);
      })()
    );
  }

  /**
   * Converts different types of operands (groups, keys, values, expressions) to strings
   * @param operand The operand to convert
   * @param context The StringBuilder to append the conversion result
   */
  convertOperandToContext(
    operand: Key | Value | Expression | Group,
    context: StringBuilder
  ): void {
    const conversionMap = {
      [Group.name]: () => this.convertGroupToContext(operand as Group, context),
      [Key.name]: () => this.convertKeyToContext(operand as Key, context),
      [Value.name]: () => this.convertValueToContext(operand as Value, context),
      [Expression.name]: () => {
        const exp = operand as Expression;

        // Validate expression structure
        if (
          exp.type !== Operator.NOT &&
          exp.type !== Operator.AND &&
          exp.type !== Operator.OR &&
          // eslint-disable-next-line no-instanceof/no-instanceof
          !(exp.right instanceof Value)
        ) {
          throw new Error(
            "Non AND/OR expression must have Value right argument!"
          );
        }

        // Handle different expression types
        // eslint-disable-next-line no-unused-expressions
        exp.type === Operator.NOT
          ? this.convertNotExpressionToContext(exp, context)
          : this.convertExpressionToContext(exp, context);
      },
    };

    const converter = conversionMap[operand.constructor.name];
    if (converter) {
      converter();
    } else {
      throw new Error("Unexpected operand type");
    }
  }

  /**
   * Transforms a NOT expression into its logically equivalent form
   * @param expression The NOT expression to convert
   * @param context The context to append the converted expression
   */
  convertNotExpressionToContext(expression: Expression, context: StringBuilder): void {
    this.convertOperandToContext(this.negateOperand(expression), context);
  }

  /**
   * Reverses the logic of an operand
   * Handles complex negation scenarios for different types of expressions
   * @param operand The operand to negate
   * @returns The logically negated operand
   */
  /* eslint-disable no-instanceof/no-instanceof */
  negateOperand(operand: Operand): Operand {
    if (operand instanceof Group) {
      let inEx = this.negateOperand(operand.content);

      // If the negated content is another group, extract its content
      if (inEx instanceof Group) {
        inEx = inEx.content;
      }

      return new Group(inEx as Expression);
    } else if (operand instanceof Expression) {
      const exp = operand as Expression;

      switch (exp.type) {
        case Operator.NOT: // NOT(NOT(a)) = a
          return this.negateOperand(exp.left as Expression);

        case Operator.AND: // NOT(a AND b) = NOT(a) OR NOT(b)
        case Operator.OR: // NOT(a OR b) = NOT(a) AND NOT(b)
          return new Expression(
            TYPE_NEGATION_MAP[exp.type],
            this.negateOperand(exp.left as Expression) as Expression,
            this.negateOperand(exp.right as Expression) as Expression
          );

        case Operator.EQ: // NOT(e EQ b) = e NE b
        case Operator.NE: // NOT(e NE b) = e EQ b
        case Operator.GT: // NOT(e GT b) = e LTE b
        case Operator.GTE: // NOT(e GTE b) = e LT b
        case Operator.LT: // NOT(e LT b) = e GTE b
        case Operator.LTE: // NOT(e LTE b) = e GT b
        case Operator.IN: // NOT(e IN [...]) = e NIN [...]
        case Operator.NIN: // NOT(e NIN [...]) = e IN [...]
          return new Expression(
            TYPE_NEGATION_MAP[exp.type],
            exp.left,
            exp.right
          );

        default:
          throw new Error(`Unknown expression type: ${exp.type}`);
      }
    } else {
      throw new Error(`Cannot negate operand of type: ${operand}`);
    }
  }
  /* eslint-enable no-instanceof/no-instanceof */

  // Abstract methods to be implemented by subclasses
  /**
   * Convert the given expression into a string representation
   * @param expression the expression to convert
   * @param context the context to append the string representation to
   */
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  convertExpressionToContext(expression: Expression, context: StringBuilder): void {
    throw new Error("must be implemented in derived class");
  }

  /**
   * Convert the given key into a string representation
   * @param filterKey the key to convert
   * @param context the context to append the string representation to
   */
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  convertKeyToContext(filterKey: Key, context: StringBuilder): void {
    throw new Error("must be implemented in derived class");
  }

  /**
   * Converts a value (single or list) to its string representation
   * @param filterValue The value to convert
   * @param context The context to append the conversion result
   */
  convertValueToContext(filterValue: Value, context: StringBuilder): void {
    if (Array.isArray(filterValue.value)) {
      this.writeValueRangeStart(filterValue, context);
      for (let i = 0; i < filterValue.value.length; i += 1) {
        this.convertSingleValueToContext(filterValue.value[i], context);
        if (i < filterValue.value.length - 1) {
          this.writeValueRangeSeparator(filterValue, context);
        }
      }
      this.writeValueRangeEnd(filterValue, context);
    } else {
      this.convertSingleValueToContext(filterValue.value, context);
    }
  }

  /**
   * Convert a single value into a string representation
   * @param value the value to convert
   * @param context the context to append the string representation to
   */
  convertSingleValueToContext(
    value: number | string | boolean,
    context: StringBuilder
  ): void {
    if (typeof value === "string") {
      context.append(`'${value}'`);
    } else {
      context.append(value.toString());
    }
  }

  /**
   * Convert a group into a string representation
   * @param group the group to convert
   * @param context the context to append the string representation to
   */
  private convertGroupToContext(group: Group, context: StringBuilder): void {
    this.writeGroupStart(group, context);
    this.convertOperandToContext(group.content, context);
    this.writeGroupEnd(group, context);
  }

  /**
   * Start group representation
   * @param group the group to convert
   * @param context the context to append the string representation to
   */
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  writeGroupStart(group: Group, context: StringBuilder): void {}

  /**
   * End group representation
   * @param group the group to convert
   * @param context the context to append the string representation to
   */
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  writeGroupEnd(group: Group, context: StringBuilder): void {}

  /**
   * Start value range representation
   * @param listValue the value range to convert
   * @param context the context to append the string representation to
   */
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  writeValueRangeStart(listValue: Value, context: StringBuilder): void {
    context.append("[");
  }

  /**
   * End value range representation
   * @param listValue the value range to convert
   * @param context the context to append the string representation to
   */
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  writeValueRangeEnd(listValue: Value, context: StringBuilder): void {
    context.append("]");
  }

  /**
   * Add value range splitter
   * @param listValue the value range to convert
   * @param context the context to append the string representation to
   */
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  writeValueRangeSeparator(listValue: Value, context: StringBuilder): void {
    context.append(",");
  }
}
