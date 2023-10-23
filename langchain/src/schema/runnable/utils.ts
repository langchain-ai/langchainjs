/**
 * An object that can be added to another object.
 */
export class AddableDict {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(initialData: Record<string, any> = {}) {
    this.data = initialData;
  }

  concat(other: AddableDict): AddableDict {
    return new AddableDict({ ...this.data, ...other.data });
  }
}
