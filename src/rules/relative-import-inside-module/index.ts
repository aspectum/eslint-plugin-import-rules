import { TSESTree } from "@typescript-eslint/utils";
import ts from "typescript";
import { createRule } from "../../utils/create-rule";
import { provider } from "../../utils/provider";

export const relativeImportInsideModule = createRule({
  name: "relative-import-inside-module",
  meta: {
    docs: {
      description: "description",
      recommended: "error",
      requiresTypeChecking: false,
    },
    messages: {
      insideModuleImportShouldBeRelative:
        "When importing from a file inside the same module, the import must be relative",
      outsideModuleImportShouldBeAbsolute:
        "When importing from another module, the import must be absolute",
      unableToResolveImport:
        "The plugin was unable to resolve this import. Ensure it is valid or check your configuration",
    },
    schema: [],
    // hasSuggestions: false,
    type: "layout",
  },
  defaultOptions: [],
  create(context) {
    return {
      ImportDeclaration(node: TSESTree.ImportDeclaration): void {
        provider.initialize(context);

        const currentFile = context.getFilename();

        const { resolvedModule } = ts.resolveModuleName(
          node.source.value,
          currentFile,
          context.parserServices?.program.getCompilerOptions()!,
          ts.sys
        );

        if (!resolvedModule?.resolvedFileName)
          return context.report({
            node: node,
            messageId: "unableToResolveImport",
          });

        const currentFileModule = provider.findModuleOfFile(currentFile);
        const importedFileModule = provider.findModuleOfFile(
          resolvedModule.resolvedFileName
        );

        const isRelativeImport = !!node.source.value.match(/^\.\.?\//);

        const isAbsoluteInsideModule =
          currentFileModule === importedFileModule && !isRelativeImport;

        if (isAbsoluteInsideModule) {
          return context.report({
            node: node,
            messageId: "insideModuleImportShouldBeRelative",
          });
        }

        const isRelativeOutsideModule =
          currentFileModule !== importedFileModule && isRelativeImport;

        if (isRelativeOutsideModule) {
          return context.report({
            node: node,
            messageId: "outsideModuleImportShouldBeAbsolute",
          });
        }
      },
    };
  },
});
