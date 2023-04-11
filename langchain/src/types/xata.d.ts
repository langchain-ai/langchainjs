declare module "@xata.io/client" {
  // Types exported from @xata.io/client are not packaged correctly so we need
  // to redeclare here the ones we use.

  interface Identifiable {
    /**
     * Unique id of this record.
     */
    id: string;
  }

  interface XataRecord<OriginalRecord extends XataRecord<any> = XataRecord<any>>
    extends Identifiable {}

  type SchemaPluginResult<Schemas extends Record<string, XataRecord>> = {
    [Key in keyof Schemas]: Repository<Schemas[Key]>;
  };

  type StringKeys<O> = Extract<keyof O, string>;
  type Values<O> = O[StringKeys<O>];
  type SelectableColumn<O, RecursivePath extends any[] = []> =
    | "*"
    | "id"
    | DataProps<O>
    | NestedColumns<O, RecursivePath>;
  type WildcardColumns<O> = Values<{
    [K in SelectableColumn<O>]: K extends `${string}*` ? K : never;
  }>;
  type ValueAtColumn<O, P extends SelectableColumn<O>> = P extends "*"
    ? Values<O>
    : P extends "id"
    ? string
    : P extends keyof O
    ? O[P]
    : P extends `${infer K}.${infer V}`
    ? K extends keyof O
      ? Values<
          NonNullable<O[K]> extends infer Item
            ? Item extends Record<string, any>
              ? V extends SelectableColumn<Item>
                ? {
                    V: ValueAtColumn<Item, V>;
                  }
                : never
              : O[K]
            : never
        >
      : never
    : never;
  type ColumnsByValue<O, Value> = Values<{
    [K in SelectableColumn<O>]: ValueAtColumn<O, K> extends infer C
      ? C extends Value
        ? K extends WildcardColumns<O>
          ? never
          : K
        : never
      : never;
  }>;
}
