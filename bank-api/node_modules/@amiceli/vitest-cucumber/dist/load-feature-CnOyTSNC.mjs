import { r as getVitestCucumberConfiguration, t as GherkinParser } from "./parser-C6SegF4O.mjs";
import { t as FeatureFileReader } from "./readfile-DnUAKH2D.mjs";
import { dirname } from "node:path";
import callsites from "callsites";
//#region src/vitest/load-feature.ts
function getCallerPath() {
	const { 2: callerFilePath } = callsites();
	return dirname(callerFilePath?.getFileName() || ``);
}
function loadFeatureFromText(featureContent, options) {
	const parser = new GherkinParser(getVitestCucumberConfiguration(options));
	featureContent.split(/\r?\n|\r|\n/g).forEach((line) => {
		parser.addLine(line);
	});
	return parser.finish()[0];
}
async function loadFeature(featureFilePath, options) {
	const callerFileDir = getCallerPath();
	const [feature] = await FeatureFileReader.fromPath({
		featureFilePath,
		callerFileDir,
		options: getVitestCucumberConfiguration(options)
	}).parseFile();
	return feature;
}
//#endregion
export { loadFeatureFromText as n, loadFeature as t };
