/**
 * An object that can be added to another object.
 */
export class AddableObject {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(initialData: Record<string, any> = {}) {
    this.data = initialData;
  }

  add(other: AddableObject): AddableObject {
    const chunk = new AddableObject({ ...this.data });
    for (const key in other.data) {
      if (!(key in chunk.data) || chunk.data[key] === null) {
        chunk.data[key] = other.data[key];
      } else if (other.data[key] !== null) {
        chunk.data[key] = +other.data[key];
      }
    }
    return chunk;
  }

  radd(other: AddableObject): AddableObject {
    const chunk = new AddableObject({ ...other.data });
    for (const key in this.data) {
      if (!(key in chunk.data) || chunk.data[key] === null) {
        chunk.data[key] = this.data[key];
      } else if (this.data[key] !== null) {
        chunk.data[key] = +this.data[key];
      }
    }
    return chunk;
  }
}
