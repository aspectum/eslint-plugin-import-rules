import { TSESTree } from "@typescript-eslint/utils";
import ts from "typescript";
import { createRule } from "../../utils/create-rule";
import { provider } from "../../utils/provider";
import { NameAndFile } from "./types";

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
        provider.initialize(context);

        const currentFile = context.getFilename();

        const resolvedModule = provider.resolveModuleName(
          currentFile,
          node.source.value
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

        const isRelativeOutsideModule =
          currentFileModule !== importedFileModule && isRelativeImport;

        if (!isAbsoluteInsideModule && !isRelativeOutsideModule) return;

        const typeChecker = context.parserServices?.program.getTypeChecker()!;
        const tsNode = context.parserServices?.esTreeNodeToTSNodeMap.get(node);

        const def = tsNode?.importClause?.name;
        const named = tsNode?.importClause?.namedBindings;
        if (named?.kind === ts.SyntaxKind.NamespaceImport) return;

        // imported objects
        const indentifiers = [
          def,
          ...(named?.elements?.map((specifier) => specifier.name) ?? []),
        ].filter(Boolean) as ts.Identifier[];

        const importMap = indentifiers.reduce((_importMap, identifier) => {
          const symbol = typeChecker.getSymbolAtLocation(identifier);
          if (!symbol) return _importMap;
          const originalSymbol = typeChecker.getAliasedSymbol(symbol);
          const fileName = originalSymbol
            .getDeclarations()?.[0]
            .getSourceFile().fileName;
          if (!fileName) return _importMap;
          _importMap.push({
            name: identifier.getText(),
            file: fileName,
            isDefault: identifier.parent.kind === ts.SyntaxKind.ImportClause,
          });
          return _importMap;
        }, [] as NameAndFile[]);

        console.log(importMap);

        if (isAbsoluteInsideModule) {
          return context.report({
            node: node,
            messageId: "insideModuleImportShouldBeRelative",
          });
        }

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
