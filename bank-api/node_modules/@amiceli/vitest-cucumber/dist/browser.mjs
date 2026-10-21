import { f as defineParameterExpression, h as FeatureFileNotFoundError, i as setVitestCucumberConfiguration, m as BrowserModeFeatureError, r as getVitestCucumberConfiguration, t as GherkinParser } from "./parser-C6SegF4O.mjs";
import { t as describeFeature } from "./describe-feature-CdxOfcs4.mjs";
import callsites from "callsites";
//#region src/browser/readfile.ts
var BrowserFeatureFileReader = class BrowserFeatureFileReader {
	path;
	parser;
	static fromPath(params) {
		return new BrowserFeatureFileReader(params);
	}
	constructor(params) {
		this.path = `${params.featureFilePath}`;
		this.parser = new GherkinParser(params.options);
	}
	async parseFile() {
		try {
			const content = await (await fetch(this.path)).text();
			for (const line of content.split("\n")) this.parser.addLine(line);
			return this.parser.finish();
		} catch (e) {
			throw new FeatureFileNotFoundError(this.path);
		}
	}
};
//#endregion
//#region src/browser/load-feature.ts
function getCallerPath() {
	const { 2: callerFilePath } = callsites();
	return callerFilePath?.getFileName() || ``;
}
function resolveFeatureUrl(specUrl, featureRelPath) {
	const url = new URL(specUrl);
	const path = decodeURIComponent(url.pathname);
	const marker = ["/src/", "/tests/"].find((m) => path.includes(m));
	if (marker) {
		const base = url.origin + path.slice(path.indexOf(marker));
		return new URL(featureRelPath, base).href;
	}
	const dir = path.substring(0, path.lastIndexOf("/"));
	return `${url.origin}/@fs${dir}/${featureRelPath}`;
}
async function loadFeature(featureFilePath, options) {
	const [feature] = await BrowserFeatureFileReader.fromPath({
		featureFilePath: featureFilePath.startsWith("/") ? featureFilePath : resolveFeatureUrl(getCallerPath() || "", featureFilePath),
		options: getVitestCucumberConfiguration(options)
	}).parseFile();
	if (!feature) throw new BrowserModeFeatureError(featureFilePath);
	return feature;
}
//#endregion
export { defineParameterExpression, describeFeature, loadFeature, setVitestCucumberConfiguration };
