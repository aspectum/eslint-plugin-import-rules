import type { TSESTree } from "@typescript-eslint/utils";
import type { RuleContext } from "@typescript-eslint/utils/dist/ts-eslint";
import fs from "fs";
import { globSync } from "glob";
import path from "path";
import ts from "typescript";
import { ImportRules } from "../../types/context-settings";
import { NameAndFile } from "./types";
import { findCommonElementsInArray } from "./utils";

class ImportRulesPluginProvider {
  private initialized = false;

  private context!: Readonly<RuleContext<any, any>>;
  private typeChecker!: ts.TypeChecker;
  private program!: ts.Program;

  modules: string[] = [];

  /**
   * Updates the context and loads the settings (for the first time)
   */
  initialize(context: Readonly<RuleContext<any, any>>) {
    // update context
    this.context = context;
    this.program = context.parserServices?.program!;
    this.typeChecker = this.program.getTypeChecker();

    if (this.initialized) return;

    // load settings

    (context.settings.importRules as ImportRules).modules.forEach((module) => {
      let absModule: string;
      if (path.isAbsolute(module)) {
        absModule = module;
      } else {
        const baseDir =
          context.parserServices?.program.getCompilerOptions().baseUrl ||
          path.dirname(
            context.parserServices?.program
              .getCompilerOptions()
              .configFilePath?.toString()!
          );

        absModule = path.join(baseDir, module);
      }

      const resolvedModules = globSync(absModule).filter(
        (module) => fs.existsSync(module) && fs.lstatSync(module).isDirectory()
      );

      this.modules.push(...resolvedModules);

      this.initialized = true;
    });
  }

  /**
   * Check if imports break the rules
   */
  check(
    context: Readonly<RuleContext<any, any>>,
    node: TSESTree.ImportDeclaration
  ) {
    this.initialize(context);

    const currentFile = context.getFilename();

    const resolvedModule = this.resolveModuleName(
      currentFile,
      node.source.value
    );

    // could not resolve import
    // could be from node_modules
    if (!resolvedModule?.resolvedFileName) return;

    // which module (defined in settings) contains the current file
    // and the imported file
    const currentFileModule = this.findModuleOfFile(currentFile);
    const importedFileModule = this.findModuleOfFile(
      resolvedModule.resolvedFileName
    );

    const isRelativeImport = !!node.source.value.match(/^\.\.?\//);

    // test if there are errors

    const isAbsoluteInsideModule =
      currentFileModule === importedFileModule && !isRelativeImport;

    const isRelativeOutsideModule =
      currentFileModule !== importedFileModule && isRelativeImport;

    return {
      isAbsoluteInsideModule,
      isRelativeOutsideModule,
      currentFile, // return to use later
      importedFileModule, // return to use later
    };
  }

  /**
   * Maps out the imports to build the fixer
   */
  buildImportMap(node: TSESTree.ImportDeclaration) {
    // get typescript node from ESLint node
    const tsNode = this.context.parserServices?.esTreeNodeToTSNodeMap.get(node);

    // import default
    const def = tsNode?.importClause?.name;

    // named import (and namespace)
    const named = tsNode?.importClause?.namedBindings;
    // each name imported
    const elements =
      named?.kind === ts.SyntaxKind.NamedImports ? named.elements : undefined;

    // imported identifiers
    const indentifiers = [
      def,
      ...(elements?.map((specifier) => specifier.name) ?? []),
    ].filter(Boolean) as ts.Identifier[];

    const importMap = indentifiers.reduce((_importMap, identifier) => {
      // get symbol from identifier
      const symbol = this.typeChecker.getSymbolAtLocation(identifier);
      if (!symbol) return _importMap;

      // get aliased symbol (symbol in original file that exported it)
      const originalSymbol = this.typeChecker.getAliasedSymbol(symbol);
      // file name of the original file that exported it
      const fileName = originalSymbol
        .getDeclarations()?.[0]
        .getSourceFile().fileName;
      if (!fileName) return _importMap;

      // map out an object with information to build the import expression
      _importMap.push({
        name: identifier.getText(),
        file: fileName,
        isDefault: identifier.parent.kind === ts.SyntaxKind.ImportClause,
        originalSymbol,
      });
      return _importMap;
    }, [] as NameAndFile[]);

    return importMap;
  }

  /**
   * Find index of module containing the input file
   */
  findModuleOfFile(file: string) {
    return this.modules.findIndex((module) => file.includes(module));
  }

  /**
   * Helper to resolve an import to a file
   */
  resolveModuleName(currentFile: string, importPath: string) {
    const { resolvedModule } = ts.resolveModuleName(
      importPath,
      currentFile,
      this.context.parserServices?.program.getCompilerOptions()!,
      ts.sys
    );

    return resolvedModule;
  }

  /**
   * Iteratively build a valid import path for the given symbol. It progresses along the
   * path of the imported file and stops as early as possible.
   * @param importPathChunks Path chunks (path.split("/")) of the import that is being built
   * @param importedFilePathChunks Path chunks (path.split("/")) of the imported file (target)
   * @param currentFile Full file path of the current file
   * @param originalSymbol Symbol being imported
   * @returns
   */
  private findImportPath(
    importPathChunks: string[],
    importedFilePathChunks: string[],
    originalSymbol: ts.Symbol
  ) {
    for (let i = 0; i < importedFilePathChunks.length; i++) {
      importPathChunks.push(importedFilePathChunks[i]);
      const path = importPathChunks.join("/");

      const sourceFile = this.program.getSourceFile(path);

      // should not happen
      if (!sourceFile) continue;

      const fileSymbol = this.typeChecker.getSymbolAtLocation(sourceFile);

      // should not happen
      if (!fileSymbol) continue;

      const exports = this.typeChecker.getExportsOfModule(fileSymbol);

      if (exports.some((e) => e === originalSymbol)) return path;
    }
  }

  /**
   * Build a relative import path for the given symbol
   */
  findRelativeImportPath(
    currentFile: string,
    importedFile: string,
    originalSymbol: ts.Symbol
  ) {
    const currentFilePathChunks = currentFile.split("/");
    const importedFilePathChunks = importedFile.split("/");

    const indexOfDivergence = findCommonElementsInArray(
      currentFilePathChunks,
      importedFilePathChunks
    );

    // adds ".." corresponding to the directories going up
    const importPaths = Array<string>(
      currentFilePathChunks.length - indexOfDivergence - 1
    ).fill("..");

    // finds the file along the import path that exports the given symbol
    const importPath = this.findImportPath(
      importPaths,
      importedFilePathChunks.splice(indexOfDivergence),
      originalSymbol
    );

    return importPath;
  }

  /**
   * Build an absolute import path for the given symbol
   */
  findAbsoluteImportPath(
    importedFile: string,
    originalSymbol: ts.Symbol,
    moduleOfImportedFile: number
  ) {
    const moduleFilePathChunks = this.modules[moduleOfImportedFile].split("/");
    const importedFilePathChunks = importedFile.split("/");

    const indexOfDivergence = findCommonElementsInArray(
      moduleFilePathChunks,
      importedFilePathChunks
    );

    const importPaths: string[] = [];

    const importPath = this.findImportPath(
      importPaths,
      // -1 because we want the module name
      importedFilePathChunks.splice(indexOfDivergence - 1),
      originalSymbol
    );

    return importPath;
  }

  /**
   * Generates the text for the import declaration
   */
  makeImportDeclaration(name: string, isDefault: boolean, importPath: string) {
    /** Below seems to be the proper way of doing it, but getText() and getFullText() throw errors */
    // const importName = isDefault
    //   ? ts.factory.createIdentifier(name)
    //   : undefined;

    // const namedBindings = !isDefault
    //   ? ts.factory.createNamedImports([
    //       ts.factory.createImportSpecifier(
    //         false,
    //         undefined,
    //         ts.factory.createIdentifier(name)
    //       ),
    //     ])
    //   : undefined;

    // const importDeclaration = ts.factory.createImportDeclaration(
    //   undefined,
    //   ts.factory.createImportClause(false, importName, namedBindings),
    //   ts.factory.createStringLiteral(importPath),
    //   undefined
    // );

    // return importDeclaration.getFullText();

    const importName = isDefault ? name : `{ ${name} }`;

    return `import ${importName} from "${importPath}";`;
  }
}

export const provider = new ImportRulesPluginProvider();
