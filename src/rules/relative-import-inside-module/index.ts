import { TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../../utils/create-rule";

export const relativeImportInsideModule = createRule({
  name: "relative-import-inside-module",
  meta: {
    docs: {
      description: "description",
      recommended: "error",
      requiresTypeChecking: false,
    },
    messages: {
      // message: "message",
    },
    schema: [],
    // hasSuggestions: false,
    type: "layout",
  },
  defaultOptions: [],
  create(context) {
    return {
      ImportDeclaration(node: TSESTree.ImportDeclaration): void {
        console.log(context.getFilename());
      },
    };
  },
});
