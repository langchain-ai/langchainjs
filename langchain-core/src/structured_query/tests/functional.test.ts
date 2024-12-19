import { test, expect } from "@jest/globals";
import { Document } from "../../documents/document.js";
import { FunctionalTranslator } from "../functional.js";
import { Comparators, Visitor } from "../ir.js";

describe("FunctionalTranslator", () => {
  const translator = new FunctionalTranslator();

  describe("getAllowedComparatorsForType", () => {
    test("string", () => {
      expect(translator.getAllowedComparatorsForType("string")).toEqual([
        Comparators.eq,
        Comparators.ne,
        Comparators.gt,
        Comparators.gte,
        Comparators.lt,
        Comparators.lte,
      ]);
    });
    test("number", () => {
      expect(translator.getAllowedComparatorsForType("number")).toEqual([
        Comparators.eq,
        Comparators.ne,
        Comparators.gt,
        Comparators.gte,
        Comparators.lt,
        Comparators.lte,
      ]);
    });
    test("boolean", () => {
      expect(translator.getAllowedComparatorsForType("boolean")).toEqual([
        Comparators.eq,
        Comparators.ne,
      ]);
    });
    test("unsupported", () => {
      expect(() =>
        translator.getAllowedComparatorsForType("unsupported")
      ).toThrow("Unsupported data type: unsupported");
    });
  });

  describe("visitComparison", () => {
    const attributesByType = {
      string: "stringValue",
      number: "numberValue",
      boolean: "booleanValue",
    };
    
    describe("returns true or false for valid comparisons", () => {
      const inputValuesByAttribute: { [key in string]: string | number | boolean } = {
        stringValue: "value",
        numberValue: 1,
        booleanValue: true,
      };
      
      const validDocumentsByComparator: { [key in string]: Document<Record<string, unknown>>[] } = {
        [Comparators.eq]: [
          new Document({
            pageContent: "",
            metadata: {
              stringValue: "value",
              numberValue: 1,
              booleanValue: true,
            },
          }),
        ],
        [Comparators.ne]: [
          new Document({
            pageContent: "",
            metadata: {
              stringValue: "not-value",
              numberValue: 0,
              booleanValue: false,
            },
          }),
        ],
        [Comparators.gt]: [
          new Document({
            pageContent: "",
            metadata: {
              stringValue: "valueee",
              numberValue: 2,
              booleanValue: true,
            },
          }),
        ],
        [Comparators.gte]: [
          // test for greater than
          new Document({
            pageContent: "",
            metadata: {
              stringValue: "valueee",
              numberValue: 2,
              booleanValue: true,
            },
          }),
          // test for equal to
          new Document({
            pageContent: "",
            metadata: {
              stringValue: "value",
              numberValue: 1,
              booleanValue: true,
            },
          }),
        ],
        [Comparators.lt]: [
          new Document({
            pageContent: "",
            metadata: {
              stringValue: "val",
              numberValue: 0,
              booleanValue: true,
            },
          }),
        ],
        [Comparators.lte]: [
          // test for less than
          new Document({
            pageContent: "",
            metadata: {
              stringValue: "val",
              numberValue: 0,
              booleanValue: true,
            },
          }),
          // test for equal to
          new Document({
            pageContent: "",
            metadata: {
              stringValue: "value",
              numberValue: 1,
              booleanValue: true,
            },
          }),
        ],
      };
      
      const invalidDocumentsByComparator: { [key in string]: Document<Record<string, unknown>>[] } = {
        [Comparators.eq]: [
          new Document({
            pageContent: "",
            metadata: {
              stringValue: "not-value",
              numberValue: 0,
              booleanValue: false,
            },
          }),
        ],
        [Comparators.ne]: [
          new Document({
            pageContent: "",
            metadata: {
              stringValue: "value",
              numberValue: 1,
              booleanValue: true,
            },
          }),
        ],
        [Comparators.gt]: [
          new Document({
            pageContent: "",
            metadata: {
              stringValue: "value",
              numberValue: 1,
              booleanValue: true,
            },
          }),
        ],
        [Comparators.gte]: [
          new Document({
            pageContent: "",
            metadata: {
              stringValue: "val",
              numberValue: 0,
              booleanValue: false,
            },
          }),
        ],
        [Comparators.lt]: [
          new Document({
            pageContent: "",
            metadata: {
              stringValue: "valueee",
              numberValue: 2,
              booleanValue: true,
            },
          }),
        ],
        [Comparators.lte]: [
          new Document({
            pageContent: "",
            metadata: {
              stringValue: "valueee",
              numberValue: 2,
              booleanValue: true,
            },
          }),
        ],
      };
      
      const stringComparators = translator.getAllowedComparatorsForType("string");
      for (const comparator of stringComparators) {
        const attribute = attributesByType.string;
        const value = inputValuesByAttribute[attribute];
        const validDocuments = validDocumentsByComparator[comparator];
        for (const validDocument of validDocuments) {
          test(`${value} -> ${comparator} -> ${validDocument.metadata[attribute]}`, () => {
            const comparison = translator.visitComparison({
              attribute,
              comparator,
              value,
              exprName: "Comparison",
              accept: (visitor: Visitor) => visitor,
            });
            const result = comparison(validDocument);
            expect(result).toBeTruthy();
          });
        }

        const invalidDocuments = invalidDocumentsByComparator[comparator];
        for (const invalidDocument of invalidDocuments) {
          test(`${value} -> ${comparator} -> ${invalidDocument.metadata[attribute]}`, () => {
            const comparison = translator.visitComparison({
              attribute,
              comparator,
              value,
              exprName: "Comparison",
              accept: (visitor: Visitor) => visitor,
            });
            const result = comparison(invalidDocument);
            expect(result).toBeFalsy();
          });
        }
      }

      const numberComparators = translator.getAllowedComparatorsForType("number");
      for (const comparator of numberComparators) {
        const attribute = attributesByType.number;
        const value = inputValuesByAttribute[attribute];
        const validDocuments = validDocumentsByComparator[comparator];
        for (const validDocument of validDocuments) {
          test(`${value} -> ${comparator} -> ${validDocument.metadata[attribute]}`, () => {
            const comparison = translator.visitComparison({
              attribute,
              comparator,
              value,
              exprName: "Comparison",
              accept: (visitor: Visitor) => visitor,
            });
            const result = comparison(validDocument);
            expect(result).toBeTruthy();
          });
        }

        const invalidDocuments = invalidDocumentsByComparator[comparator];
        for (const invalidDocument of invalidDocuments) {
          test(`${value} -> ${comparator} -> ${invalidDocument.metadata[attribute]}`, () => {
            const comparison = translator.visitComparison({
              attribute,
              comparator,
              value,
              exprName: "Comparison",
              accept: (visitor: Visitor) => visitor,
            });
            const result = comparison(invalidDocument);
            expect(result).toBeFalsy();
          });
        }
      }

      const booleanComparators = translator.getAllowedComparatorsForType("boolean");
      for (const comparator of booleanComparators) {
        const attribute = attributesByType.boolean;
        const value = inputValuesByAttribute[attribute];
        const validDocuments = validDocumentsByComparator[comparator];
        for (const validDocument of validDocuments) {
          test(`${value} -> ${comparator} -> ${validDocument.metadata[attribute]}`, () => {
            const comparison = translator.visitComparison({
              attribute,
              comparator,
              value,
              exprName: "Comparison",
              accept: (visitor: Visitor) => visitor,
            });
            const result = comparison(validDocument);
            expect(result).toBeTruthy();
          });
        }
        const invalidDocuments = invalidDocumentsByComparator[comparator];
        for (const invalidDocument of invalidDocuments) {
          test(`${value} -> ${comparator} -> ${invalidDocument.metadata[attribute]}`, () => {
            const comparison = translator.visitComparison({
              attribute,
              comparator,
              value,
              exprName: "Comparison",
              accept: (visitor: Visitor) => visitor,
            });
            const result = comparison(invalidDocument);
            expect(result).toBeFalsy();
          });
        }
      }
    });
  });
});
