import { SerializedConstitutionalPrinciple } from "../serde.js";

/**
 * Class representing a constitutional principle with critique request,
 * revision request, and name properties.
 */
export class ConstitutionalPrinciple {
  critiqueRequest: string;

  revisionRequest: string;

  name: string;

  constructor({
    critiqueRequest,
    revisionRequest,
    name,
  }: {
    critiqueRequest: string;
    revisionRequest: string;
    name?: string;
  }) {
    this.critiqueRequest = critiqueRequest;
    this.revisionRequest = revisionRequest;
    this.name = name ?? "Constitutional Principle";
  }

  serialize(): SerializedConstitutionalPrinciple {
    return {
      _type: "constitutional_principle",
      critiqueRequest: this.critiqueRequest,
      revisionRequest: this.revisionRequest,
      name: this.name,
    };
  }
}

export const PRINCIPLES: {
  [key: string]: ConstitutionalPrinciple;
} = {};
