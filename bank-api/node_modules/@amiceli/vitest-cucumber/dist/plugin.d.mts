import { Project } from "ts-morph";
import { ViteDevServer } from "vite";

//#region src/plugin/ast/BaseAst.d.ts
type AstOptions = {
  specFilePath: string;
  featureFilePath: string;
  onDeleteAction?: 'comment' | 'delete';
  formatCommand?: string;
};
//#endregion
//#region src/plugin/index.d.ts
type VitestCucumberPluginOptions = {
  featureFilesDir: string;
  specFilesDir: string;
} & Pick<AstOptions, 'onDeleteAction' | 'formatCommand'>;
declare function VitestCucumberPlugin(options: VitestCucumberPluginOptions): {
  name: string;
  configureServer(server: ViteDevServer): void;
};
//#endregion
export { VitestCucumberPlugin };