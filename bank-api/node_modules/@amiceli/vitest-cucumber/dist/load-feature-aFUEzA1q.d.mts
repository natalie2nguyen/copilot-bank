import { i as Feature, t as ParserOptions } from "./parser-B2QnpJTk.mjs";

//#region src/vitest/load-feature.d.ts
declare function loadFeatureFromText(featureContent: string, options?: ParserOptions): Feature;
declare function loadFeature(featureFilePath: string, options?: ParserOptions): Promise<Feature>;
//#endregion
export { loadFeatureFromText as n, loadFeature as t };