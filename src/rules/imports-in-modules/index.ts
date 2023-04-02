import { TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../../utils/create-rule";
import { provider } from "../../utils/provider";

export const importsInModules = createRule({
  name: "imports-in-modules",
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
    type: "layout",
    fixable: "code",
  },
  defaultOptions: [],
  create(context) {
    return {
      ImportDeclaration(node: TSESTree.ImportDeclaration): void {
        // check if there is an error
        const checkResults = provider.check(context, node);

        // could not resolve import
        // assume it is from node_modules
        if (!checkResults) return;
        // return context.report({
        //   node: node,
        //   messageId: "unableToResolveImport",
        // });

        const {
          isAbsoluteInsideModule,
          isRelativeOutsideModule,
          currentFile,
          importedFileModule,
        } = checkResults;

        // no errors
        if (!isAbsoluteInsideModule && !isRelativeOutsideModule) return;

        // some pre-processing to build the import expression
        const importMap = provider.buildImportMap(node)!;

        if (isAbsoluteInsideModule) {
          const importTexts = importMap
            .map((imp) => {
              const importPath = provider.findRelativeImportPath(
                currentFile,
                imp.file,
                imp.originalSymbol
              );

              if (!importPath) return;

              const importText = provider.makeImportDeclaration(
                imp.name,
                imp.isDefault,
                importPath
              );

              return importText;
            })
            .filter((importText) => importText !== undefined) as string[];

          return context.report({
            node: node,
            messageId: "insideModuleImportShouldBeRelative",
            fix: (fixer) => [
              fixer.remove(node),
              fixer.insertTextAfter(node, importTexts.join("\n")),
            ],
          });
        }

        if (isRelativeOutsideModule) {
          const importTexts = importMap
            .map((imp) => {
              const importPath = provider.findAbsoluteImportPath(
                imp.file,
                imp.originalSymbol,
                importedFileModule
              );

              if (!importPath) return;

              const importText = provider.makeImportDeclaration(
                imp.name,
                imp.isDefault,
                importPath
              );

              return importText;
            })
            .filter((importText) => importText !== undefined) as string[];

          return context.report({
            node: node,
            messageId: "outsideModuleImportShouldBeAbsolute",
            fix: (fixer) => [
              fixer.remove(node),
              fixer.insertTextAfter(node, importTexts.join("\n")),
            ],
          });
        }
      },
    };
  },
});
