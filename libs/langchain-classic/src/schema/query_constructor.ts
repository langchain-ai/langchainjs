/**
 * A simple data structure that holds information about an attribute. It
 * is typically used to provide metadata about attributes in other classes
 * or data structures within the LangChain framework.
 */
export class AttributeInfo {
  constructor(
    public name: string,
    public type: string,
    public description: string
  ) {}
}
