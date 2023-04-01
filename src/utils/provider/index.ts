import type { RuleContext } from "@typescript-eslint/utils/dist/ts-eslint";
import fs from "fs";
import { globSync } from "glob";
import path from "path";
import ts from "typescript";
import { ImportRules } from "../../types/context-settings";

class ImportRulesPluginProvider {
  private initialized = false;

  private context!: Readonly<RuleContext<any, any>>;

  modules: string[] = [];

  initialize(context: Readonly<RuleContext<any, any>>) {
    if (this.initialized) return;

    this.context = context;

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

  findModuleOfFile(file: string) {
    return this.modules.findIndex((module) => file.includes(module));
  }

  resolveModuleName(currentFile: string, importPath: string) {
    const { resolvedModule } = ts.resolveModuleName(
      importPath,
      currentFile,
      this.context.parserServices?.program.getCompilerOptions()!,
      ts.sys
    );

    return resolvedModule;
  }

  findRelativeImportPath(currentFile: string, importedFile: string) {
    const currentFilePaths = currentFile.split("/");
    const importedFilePaths = importedFile.split("/");
    let i = 0;
    for (
      i = 0;
      i < currentFilePaths.length && i < importedFilePaths.length;
      i++
    ) {
      if (currentFilePaths[i] !== importedFilePaths[i]) {
        break;
      }
    }
    const importPaths = Array<string>(currentFilePaths.length - i - 1).fill(
      ".."
    );

    for (let j = 0; j < importPaths.length; j++) {
      importPaths.push(importedFilePaths[i]);
      const path = importPaths.join("/");
      const resolvedModule = this.resolveModuleName(currentFile, path);
      if (resolvedModule) return path;
    }

    throw new Error("Could not find relative import path");
  }

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

    return `import ${importName} from ${importPath};`;
  }

  generateAbsoluteImport(file: string, module: number) {
    const pathBeforeModule = this.modules[module].replace(/[^/]+$/, "");

    const chunks = file.replace(pathBeforeModule, "").split("/");

    let importPath = "";

    for (let i = 0; i < chunks.length; i++) {
      importPath += "/" + chunks[i];
    }
  }
}

export const provider = new ImportRulesPluginProvider();
