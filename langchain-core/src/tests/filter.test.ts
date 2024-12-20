import { test, expect, describe } from "@jest/globals";
import {
  FilterExpressionBuilder,
  BaseFilterExpressionConverter,
  StringBuilder,
  FilterExpressionConverter,
  Expression,
  Key,
  Value,
  Group,
} from "../filter.js";

class TestFilterExpressionConverter
  extends BaseFilterExpressionConverter
  implements FilterExpressionConverter
{
  constructor() {
    super();
  }

  convertExpression(expression: Expression): string {
    return super.convertExpression(expression);
  }

  convertExpressionToContext(expression: Expression, context: StringBuilder): void {
    super.convertOperandToContext(expression.left, context);
    super.convertSymbolToContext(expression, context);
    super.convertOperandToContext(expression.right!, context);
  }

  convertKeyToContext(key: Key, context: StringBuilder): void {
    context.append(`'$.${key.key}'`);
  }

  writeValueRangeStart(_listValue: Value, context: StringBuilder): void {
    context.append("[");
  }

  writeValueRangeEnd(_listValue: Value, context: StringBuilder): void {
    context.append("]");
  }

  writeGroupStart(_group: Group, context: StringBuilder): void {
    context.append("(");
  }

  writeGroupEnd(_group: Group, context: StringBuilder): void {
    context.append(")");
  }
}
describe("filter test", () => {
  const b = new FilterExpressionBuilder();
  const impl = new TestFilterExpressionConverter();

  test("filter base", async () => {
    expect(impl.convertExpression(b.eq("a", 2015))).toEqual("'$.a' = 2015");
    expect(impl.convertExpression(b.ne("a", 2015))).toEqual("'$.a' != 2015");
    expect(impl.convertExpression(b.gte("a", 2015))).toEqual("'$.a' >= 2015");
    expect(impl.convertExpression(b.in("a", [2015, 2018]))).toEqual(
      "'$.a' IN [2015,2018]"
    );
    expect(impl.convertExpression(b.nin("a", [2015, 2018]))).toEqual(
      "'$.a' NOT IN [2015,2018]"
    );
    expect(impl.convertExpression(b.lte("a", 2015))).toEqual("'$.a' <= 2015");
    expect(impl.convertExpression(b.gt("a", 2015))).toEqual("'$.a' > 2015");
    expect(impl.convertExpression(b.lt("a", 2015))).toEqual("'$.a' < 2015");
  });

  test("filter negate base", async () => {
    expect(impl.convertExpression(b.not(b.eq("a", 2015)))).toEqual(
      "'$.a' != 2015"
    );
    expect(impl.convertExpression(b.not(b.ne("a", 2015)))).toEqual(
      "'$.a' = 2015"
    );
    expect(impl.convertExpression(b.not(b.gte("a", 2015)))).toEqual(
      "'$.a' < 2015"
    );
    expect(impl.convertExpression(b.not(b.in("a", [2015, 2018])))).toEqual(
      "'$.a' NOT IN [2015,2018]"
    );
    expect(impl.convertExpression(b.not(b.nin("a", [2015, 2018])))).toEqual(
      "'$.a' IN [2015,2018]"
    );
    expect(impl.convertExpression(b.not(b.lte("a", 2015)))).toEqual(
      "'$.a' > 2015"
    );
    expect(impl.convertExpression(b.not(b.gt("a", 2015)))).toEqual(
      "'$.a' <= 2015"
    );
    expect(impl.convertExpression(b.not(b.lt("a", 2015)))).toEqual(
      "'$.a' >= 2015"
    );
  });

  test("filter Group", async () => {
    expect(
      impl.convertExpression(
        b.and(b.eq("name", "martin"), b.eq("firstname", "john"))
      )
    ).toEqual("'$.name' = 'martin' AND '$.firstname' = 'john'");
    expect(
      impl.convertExpression(
        b.or(b.eq("name", "martin"), b.eq("firstname", "john"))
      )
    ).toEqual("'$.name' = 'martin' OR '$.firstname' = 'john'");

    expect(
      impl.convertExpression(
        b.not(b.and(b.eq("name", "martin"), b.eq("firstname", "john")))
      )
    ).toEqual("'$.name' != 'martin' OR '$.firstname' != 'john'");
    expect(
      impl.convertExpression(
        b.not(b.or(b.eq("name", "martin"), b.eq("firstname", "john")))
      )
    ).toEqual("'$.name' != 'martin' AND '$.firstname' != 'john'");

    expect(
      impl.convertExpression(
        b.and(
          b.eq("name", "martin"),
          b.group(b.or(b.eq("firstname", "john"), b.eq("firstname", "jack")))
        )
      )
    ).toEqual(
      "'$.name' = 'martin' AND ('$.firstname' = 'john' OR '$.firstname' = 'jack')"
    );

    expect(
      impl.convertExpression(
        b.not(
          b.and(
            b.eq("name", "martin"),
            b.group(b.or(b.eq("firstname", "john"), b.eq("firstname", "jack")))
          )
        )
      )
    ).toEqual(
      "'$.name' != 'martin' OR ('$.firstname' != 'john' AND '$.firstname' != 'jack')"
    );
  });
});
