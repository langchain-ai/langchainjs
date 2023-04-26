import { SerializedConstitutionalPrinciple } from "../../chains/serde.js";

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
