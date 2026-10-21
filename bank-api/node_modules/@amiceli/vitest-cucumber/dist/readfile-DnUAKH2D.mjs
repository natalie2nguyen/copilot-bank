import { h as FeatureFileNotFoundError, t as GherkinParser } from "./parser-C6SegF4O.mjs";
import fs from "node:fs";
import readline from "node:readline";
//#region src/parser/readfile.ts
var FeatureFileReader = class FeatureFileReader {
	path;
	parser;
	callerFileDir;
	static fromPath(params) {
		return new FeatureFileReader(params);
	}
	constructor(params) {
		this.callerFileDir = params.callerFileDir || null;
		this.path = this.handleFeatureFilePath(params.featureFilePath);
		this.parser = new GherkinParser(params.options);
	}
	handleFeatureFilePath(featureFilePath) {
		if (featureFilePath.match(/\.\/[\w-]+(\.[\w-]+)*$/)) return `${this.callerFileDir}/${featureFilePath}`;
		return featureFilePath;
	}
	async parseFile() {
		if (!fs.existsSync(this.path)) throw new FeatureFileNotFoundError(this.path).message;
		let parseFilleError = null;
		const fileStream = fs.createReadStream(this.path);
		const rl = readline.createInterface({
			input: fileStream,
			crlfDelay: Number.POSITIVE_INFINITY
		});
		rl.on(`line`, (line) => {
			try {
				if (!parseFilleError) this.parser.addLine(line);
			} catch (e) {
				parseFilleError = e;
			}
		});
		return new Promise((resolve, reject) => {
			rl.on(`close`, () => {
				if (parseFilleError) reject(parseFilleError);
				else resolve(this.parser.finish());
			});
		});
	}
};
//#endregion
export { FeatureFileReader as t };
