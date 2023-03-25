import type { RuleContext } from "@typescript-eslint/utils/dist/ts-eslint";
import path from "path";
import fs from "fs";
import { globSync } from "glob";
import { ImportRules } from "../../types/context-settings";

class ImportRulesPluginProvider {
  initialized = false;

  modules: string[] = [];

  initialize(context: Readonly<RuleContext<any, any>>) {
    if (this.initialized) return;

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
}

export const provider = new ImportRulesPluginProvider();
