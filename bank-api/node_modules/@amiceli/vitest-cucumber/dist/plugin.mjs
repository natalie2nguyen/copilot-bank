import { b as VitestsCucumberError, d as ScenarioOutline, p as ExpressionStep, r as getVitestCucumberConfiguration } from "./parser-C6SegF4O.mjs";
import { t as FeatureFileReader } from "./readfile-DnUAKH2D.mjs";
import path from "node:path";
import fs from "node:fs";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { Project, SyntaxKind } from "ts-morph";
import fs$1 from "node:fs/promises";
//#region scripts/generateFile.ts
function generateStep(step) {
	if (step.docStrings) return `      ${step.type}(\`${step.details}\`, (_, docString: string) => { })`;
	return `      ${step.type}(\`${step.details}\`, () => { })`;
}
function generateScenarii(scenarii, forRule = false) {
	const fileContent = [""];
	for (const scenario of scenarii) {
		const isOutline = scenario instanceof ScenarioOutline;
		const scenarioStepTypes = [
			"Given",
			"When",
			"Then",
			"And",
			"But"
		].filter((step) => scenario.steps.map((scenarioSteps) => scenarioSteps.type).includes(step));
		let scenarioType = "Scenario";
		if (isOutline) scenarioType = forRule ? "RuleScenarioOutline" : "ScenarioOutline";
		else scenarioType = forRule ? "RuleScenario" : "Scenario";
		if (isOutline) fileContent.push(`  ${scenarioType}(\`${scenario.description}\`, ({ ${scenarioStepTypes.join(", ")} }, variables) => {`);
		else fileContent.push(`  ${scenarioType}(\`${scenario.description}\`, ({ ${scenarioStepTypes.join(", ")} }) => {`);
		for (const step of scenario.steps) fileContent.push(generateStep(step));
		fileContent.push(`  })`);
	}
	return fileContent;
}
function generateBackground(back, forRule = false) {
	const fileContent = [""];
	const scenarioStepTypes = [
		"Given",
		"When",
		"Then",
		"And",
		"But"
	].filter((step) => back.steps.map((scenarioSteps) => scenarioSteps.type.toString()).includes(step));
	const scenarioType = forRule ? "RuleBackground" : "Background";
	fileContent.push(`  ${scenarioType}(({ ${scenarioStepTypes.join(", ")} }) => {`);
	for (const step of back.steps) fileContent.push(`      ${step.type}(\`${step.details}\`, () => { })`);
	fileContent.push(`  })`);
	return fileContent;
}
function generateRules(rules) {
	const fileContent = [];
	for (const r of rules) {
		const rulesHook = [];
		if (r.background) rulesHook.push("RuleBackground");
		if (r.scenarii.some((s) => s instanceof ScenarioOutline)) rulesHook.push("RuleScenarioOutline");
		if (r.scenarii.some((s) => !(s instanceof ScenarioOutline))) rulesHook.push("RuleScenario");
		fileContent.push("");
		fileContent.push(`  Rule(\`${r.name}\`, ({ ${rulesHook.join(", ")} }) => {`);
		if (r.background) fileContent.push(...generateBackground(r.background, true));
		fileContent.push(...generateScenarii(r.scenarii, true));
		fileContent.push("");
		fileContent.push(`  })`);
	}
	return fileContent;
}
async function writeSpecFile({ feature, specFilePath, featureFilePath }) {
	const featureHasBackground = feature.background !== null;
	const featureHasScenario = feature.scenarii.some((s) => !(s instanceof ScenarioOutline));
	const featureHasScenarioOutline = feature.scenarii.some((s) => s instanceof ScenarioOutline);
	const fileContentLines = [];
	const describeHook = [
		"BeforeAllScenarios",
		"AfterAllScenarios",
		"BeforeEachScenario",
		"AfterEachScenario"
	];
	const describeFeatureArgs = [...describeHook];
	if (featureHasBackground) describeFeatureArgs.push("Background");
	if (featureHasScenarioOutline) describeFeatureArgs.push("ScenarioOutline");
	if (featureHasScenario) describeFeatureArgs.push("Scenario");
	if (feature.rules.length > 0) describeFeatureArgs.push("Rule");
	fileContentLines.push("import { loadFeature, describeFeature } from \"@amiceli/vitest-cucumber\"");
	fileContentLines.push("");
	fileContentLines.push(`const feature = await loadFeature('${featureFilePath}')`);
	fileContentLines.push("");
	fileContentLines.push(`describeFeature(feature, ({ ${describeFeatureArgs.join(", ")} }) => {`);
	for (const s of describeHook) fileContentLines.push(`  ${s}(() => {})`);
	if (featureHasBackground) fileContentLines.push(...generateBackground(feature.background));
	fileContentLines.push(...generateScenarii(feature.scenarii), ...generateRules(feature.rules));
	fileContentLines.push("");
	fileContentLines.push(`})`);
	await fs$1.writeFile(specFilePath, fileContentLines.join("\n"));
}
//#endregion
//#region src/plugin/ast/AstUtils.ts
var AstUtils = class AstUtils {
	callExpressions = [];
	sourceParent;
	constructor(sourceParent) {
		this.sourceParent = sourceParent;
	}
	static fromSourceFile(sourceFile) {
		return new AstUtils(sourceFile);
	}
	static fromArrowFunction(parent) {
		return new AstUtils(parent);
	}
	listDescendantCallExpressions() {
		this.callExpressions = this.sourceParent.getDescendantsOfKind(SyntaxKind.CallExpression);
		return this;
	}
	matchExpressionName(text) {
		this.callExpressions = this.callExpressions.filter((expression) => {
			return expression.getExpression().getText() === text;
		});
		return this;
	}
	matchExpressionArg(argRequired) {
		this.callExpressions = this.callExpressions.filter((expression) => {
			return expression.getArguments().find((arg) => AstUtils.isString(arg.getKind()))?.getText().replace(/^['"`]|['"`]$/g, "").includes(argRequired);
		});
		return this;
	}
	textMatchRegex(regex) {
		this.callExpressions = this.callExpressions.filter((expression) => {
			return regex.test(expression.getText());
		});
		return this;
	}
	getAll() {
		return this.callExpressions;
	}
	getOne() {
		return this.callExpressions.at(0);
	}
	static isString(kind) {
		return [
			SyntaxKind.StringLiteral,
			SyntaxKind.NoSubstitutionTemplateLiteral,
			SyntaxKind.TemplateExpression
		].includes(kind);
	}
};
//#endregion
//#region src/plugin/ast/BaseAst.ts
var BaseAst = class {
	options;
	project;
	sourceFile;
	onDeleteAction;
	formatCommand;
	constructor(options) {
		this.options = options;
		this.onDeleteAction = options.onDeleteAction || "delete";
		this.formatCommand = options.formatCommand;
		this.project = new Project({});
		this.project.addSourceFilesAtPaths(options.specFilePath);
		this.sourceFile = this.checkSourceFile();
	}
	resetProject() {
		this.project.removeSourceFile(this.sourceFile);
		this.project.addSourceFilesAtPaths(this.options.specFilePath);
		this.sourceFile = this.checkSourceFile();
	}
	checkSourceFile() {
		const realSpecPath = path.resolve(process.cwd(), this.options.specFilePath);
		const sourceFile = this.project.getSourceFiles(realSpecPath).at(0);
		if (sourceFile) return sourceFile;
		throw new Error(`sourcefile not found : ${realSpecPath}`);
	}
	callExpressionMatchRegExp(parent, regex) {
		return AstUtils.fromArrowFunction(parent).listDescendantCallExpressions().textMatchRegex(regex).getAll().map((callExpression) => {
			return {
				name: this.getFirstArgumentAsString(callExpression),
				callExpression
			};
		}).filter((step) => {
			return step?.name !== void 0;
		});
	}
	getFirstArgumentAsString(callExpression) {
		return callExpression.getArguments().find((arg) => AstUtils.isString(arg.getKind()))?.getText().replace(/^['"`]|['"`]$/g, "");
	}
	removeChildFromParent(parent, child) {
		const childParentNode = child.getParentIfKind(SyntaxKind.ExpressionStatement);
		if (childParentNode) parent.removeStatement(childParentNode.getChildIndex());
	}
	commentExpression(parent, child) {
		const code = child.getText().split("\n").map((line) => `// ${line}`).join("\n");
		this.removeChildFromParent(parent, child);
		parent.addStatements(code);
	}
	updateSyntaxListChild(arrow, newArgs) {
		const syntaxListChild = arrow.getFirstChildByKind(SyntaxKind.SyntaxList);
		if (syntaxListChild) {
			const currentArgs = [...syntaxListChild.getText().matchAll(/\b(BeforeEachScenario|BeforeAllScenarios|AfterAllScenarios|AfterEachScenario)\b/g)].map((match) => match[0]);
			syntaxListChild.replaceWithText(`{ ${newArgs.concat(currentArgs).join(",")} }`);
		} else arrow.insertParameter(0, { name: `{ ${newArgs.join(",")} }` });
	}
	get shouldComment() {
		return this.onDeleteAction === "comment";
	}
};
//#endregion
//#region src/plugin/ast/StepAst.ts
var StepAst = class StepAst extends BaseAst {
	stepableParent;
	stepParentFunction;
	constructor(options) {
		super(options);
		this.stepableParent = options.stepParent;
		this.stepParentFunction = options.stepParentFunction;
	}
	static fromOptions(options) {
		return new StepAst(options);
	}
	handleSteps() {
		const stepExpressions = this.getStepExpressions();
		const stepsToAdd = this.getStepsToAdd(stepExpressions);
		const stepsToRemove = this.getStepsToRemove(stepExpressions);
		for (const s of stepsToRemove) if (this.shouldComment) this.commentExpression(this.stepParentFunction, s.callExpression);
		else this.removeChildFromParent(this.stepParentFunction, s.callExpression);
		for (const step of stepsToAdd) this.stepParentFunction.addStatements(generateStep(step));
	}
	getStepsToRemove(parentSteps) {
		return parentSteps.filter((stepExpression) => {
			return this.stepableParent.steps.some((step) => {
				return this.stepMatchCallExpression(stepExpression, step);
			}) === false;
		});
	}
	getStepsToAdd(parentSteps) {
		return this.stepableParent.steps.filter((step) => {
			return !parentSteps.some((stepExpression) => {
				return this.stepMatchCallExpression(stepExpression, step);
			});
		});
	}
	stepMatchCallExpression(stepExpression, step) {
		return ExpressionStep.matchStep(step, stepExpression.name).length > 0 || stepExpression.name === step.details;
	}
	isStepLine(line) {
		return /\b(Given|Then|When|And|But)\b/.test(line);
	}
	getStepExpressions() {
		return this.stepParentFunction.getDescendantsOfKind(SyntaxKind.CallExpression).filter((call) => this.isStepLine(call.getText())).map((callExpression) => {
			return {
				name: callExpression.getArguments().find((arg) => AstUtils.isString(arg.getKind()))?.getText().replace(/^['"`]|['"`]$/g, ""),
				callExpression
			};
		}).filter((step) => step?.name !== void 0);
	}
};
//#endregion
//#region src/plugin/ast/StepableAst.ts
var StepableAst = class extends BaseAst {
	stepableParent;
	stepableParentFunction;
	forRule;
	constructor(options) {
		super(options);
		this.stepableParent = options.stepableParent;
		this.stepableParentFunction = options.stepableParentFunction;
		this.forRule = options.forRule === true;
	}
	updateStepableArguments(stepable, stepableArrowFunction) {
		const stepTypesArg = `{ ${stepable.steps.map((step) => step.type).join(",")} }`;
		const currentArg = stepableArrowFunction.getFirstDescendantByKind(SyntaxKind.ObjectBindingPattern);
		if (currentArg) currentArg.replaceWithText(stepTypesArg);
	}
};
//#endregion
//#region src/plugin/ast/BackgroundAst.ts
var BackgroundAst = class BackgroundAst extends StepableAst {
	constructor(options) {
		super(options);
	}
	static fromOptions(options) {
		return new BackgroundAst(options);
	}
	handleBackground() {
		const backgroundCallExpression = this.getBackgroundCallExpression();
		if (backgroundCallExpression === void 0 && this.stepableParent.background !== null) this.stepableParentFunction.insertStatements(0, generateBackground(this.stepableParent.background, this.forRule));
		if (backgroundCallExpression !== void 0 && this.stepableParent.background === null) if (this.shouldComment) this.commentExpression(this.stepableParentFunction, backgroundCallExpression);
		else this.removeChildFromParent(this.stepableParentFunction, backgroundCallExpression);
		if (backgroundCallExpression !== void 0 && this.stepableParent.background !== null) {
			const arrowFunction = this.getBackgroundArrowFunction();
			if (arrowFunction) {
				StepAst.fromOptions({
					...this.options,
					stepParent: this.stepableParent.background,
					stepParentFunction: arrowFunction
				}).handleSteps();
				this.updateStepableArguments(this.stepableParent.background, arrowFunction);
			}
		}
	}
	getBackgroundArrowFunction() {
		return this.getBackgroundCallExpression()?.getArguments().find((arg) => arg.isKind(SyntaxKind.ArrowFunction));
	}
	getBackgroundCallExpression() {
		const regex = this.forRule ? /\bRuleBackground\(/ : /\bBackground\(/;
		return this.stepableParentFunction.getDescendantsOfKind(SyntaxKind.CallExpression).find((call) => {
			return regex.test(call.getText());
		});
	}
};
//#endregion
//#region src/plugin/ast/ScenarioAst.ts
var ScenarioAst = class ScenarioAst extends StepableAst {
	constructor(options) {
		super(options);
	}
	static fromOptions(options) {
		return new ScenarioAst(options);
	}
	handleScenarii() {
		const scenariiArrow = this.getScenariiArrowFunction();
		const scenariiToAdd = this.getMissingScenarri(scenariiArrow);
		const scenariiToRemove = this.getScenariiToRemove(scenariiArrow);
		for (const s of scenariiToRemove) if (this.shouldComment) this.commentExpression(this.stepableParentFunction, s.callExpression);
		else this.removeChildFromParent(this.stepableParentFunction, s.callExpression);
		this.stepableParentFunction.addStatements(generateScenarii(scenariiToAdd || [], this.forRule));
		for (const scenario of this.stepableParent.scenarii) {
			const scenarioArrowFunction = this.getScenarioArrowFunction(scenario);
			if (scenarioArrowFunction) {
				StepAst.fromOptions({
					...this.options,
					stepParent: scenario,
					stepParentFunction: scenarioArrowFunction
				}).handleSteps();
				this.updateStepableArguments(scenario, scenarioArrowFunction);
			}
		}
	}
	getScenarioArrowFunction(scenario) {
		const scenarioFunction = this.getScenariiArrowFunction().find((s) => s.name === scenario.description);
		if (scenarioFunction) return scenarioFunction.callExpression.getArguments().find((arg) => arg.isKind(SyntaxKind.ArrowFunction));
	}
	getScenariiToRemove(parentScenarii) {
		return parentScenarii.filter((scenario) => {
			return scenario.name && this.stepableParent.scenarii.map((s) => s.description).includes(scenario.name) === false;
		});
	}
	getMissingScenarri(parentScenarii) {
		return this.stepableParent.scenarii.filter((scenario) => {
			return parentScenarii.map((s) => s.name).includes(scenario.description) === false;
		});
	}
	getScenariiArrowFunction() {
		return this.callExpressionMatchRegExp(this.stepableParentFunction, this.forRule ? /\b(RuleScenario|RuleScenarioOutline)\(/ : /\b(Scenario|ScenarioOutline)\(/);
	}
};
//#endregion
//#region src/plugin/ast/RuleAst.ts
var RuleAst = class RuleAst extends BaseAst {
	ruleParent;
	ruleParentFunction;
	constructor(options) {
		super(options);
		this.ruleParent = options.ruleParent;
		this.ruleParentFunction = options.ruleParentFunction;
	}
	static fromOptions(options) {
		return new RuleAst(options);
	}
	handleRules() {
		const rulesArrow = this.getRulesArrowFunction();
		const rulesToAdd = this.getMissingRules(rulesArrow);
		const rulesToRemove = this.getRulesToRemove(rulesArrow);
		for (const rule of rulesToRemove) if (this.shouldComment) this.commentExpression(this.ruleParentFunction, rule.callExpression);
		else this.removeChildFromParent(this.ruleParentFunction, rule.callExpression);
		this.ruleParentFunction.addStatements(generateRules(rulesToAdd || []));
		for (const rule of this.ruleParent.rules) {
			const ruleArrowFunction = this.getRuleArrowFunction(rule);
			if (ruleArrowFunction) {
				ScenarioAst.fromOptions({
					...this.options,
					stepableParent: rule,
					stepableParentFunction: ruleArrowFunction,
					forRule: true
				}).handleScenarii();
				BackgroundAst.fromOptions({
					...this.options,
					stepableParent: rule,
					stepableParentFunction: ruleArrowFunction,
					forRule: true
				}).handleBackground();
				this.updateRuleArgument(rule, ruleArrowFunction);
			}
		}
	}
	updateRuleArgument(rule, ruleArrowFunction) {
		const ruleRequiredArgs = [
			rule.background ? "RuleBackground" : void 0,
			rule.hasScenarioOutline ? "RuleScenarioOutline" : void 0,
			rule.hasScenario ? "RuleScenario" : void 0
		].filter((s) => s !== void 0);
		this.updateSyntaxListChild(ruleArrowFunction, ruleRequiredArgs);
	}
	getRuleArrowFunction(rule) {
		const scenarioFunction = this.getRulesArrowFunction().find((s) => s.name === rule.name);
		if (scenarioFunction) return scenarioFunction.callExpression.getArguments().find((arg) => arg.isKind(SyntaxKind.ArrowFunction));
	}
	getRulesToRemove(parentScenarii) {
		return parentScenarii.filter((rule) => {
			return rule.name && this.ruleParent.rules.map((s) => s.name).includes(rule.name) === false;
		});
	}
	getMissingRules(parentScenarii) {
		return this.ruleParent.rules.filter((scenario) => {
			return parentScenarii.map((s) => s.name).includes(scenario.name) === false;
		});
	}
	getRulesArrowFunction() {
		return this.callExpressionMatchRegExp(this.ruleParentFunction, /\bRule\(/);
	}
};
//#endregion
//#region src/plugin/ast/FeatureAst.ts
var FeatureAst = class FeatureAst extends BaseAst {
	feature = null;
	constructor(options) {
		super(options);
	}
	static fromOptions(options) {
		return new FeatureAst(options);
	}
	async loadFeautreFromFile() {
		const [feature] = await FeatureFileReader.fromPath({
			featureFilePath: this.options.featureFilePath,
			callerFileDir: null,
			options: getVitestCucumberConfiguration()
		}).parseFile();
		return feature;
	}
	async updateSpecFile() {
		try {
			this.feature = await this.loadFeautreFromFile();
			await this.handleDescribeFeature();
			this.handleFeature();
			await this.formatAndSave();
			if (this.options.formatCommand) await promisify(exec)(`${this.options.formatCommand} ${this.options.specFilePath}`);
		} catch (e) {
			throw new VitestsCucumberError(`FeatureAst error: ${e.message}`);
		}
	}
	async handleDescribeFeature() {
		if (!this.describeFeature && this.feature) {
			await writeSpecFile({
				feature: this.feature,
				specFilePath: this.options.specFilePath,
				featureFilePath: this.options.featureFilePath
			});
			this.resetProject();
		}
	}
	handleFeature() {
		if (this.describeFeatureCallback && this.feature) {
			ScenarioAst.fromOptions({
				...this.options,
				stepableParent: this.feature,
				stepableParentFunction: this.describeFeatureCallback
			}).handleScenarii();
			RuleAst.fromOptions({
				...this.options,
				ruleParent: this.feature,
				ruleParentFunction: this.describeFeatureCallback
			}).handleRules();
			BackgroundAst.fromOptions({
				...this.options,
				stepableParent: this.feature,
				stepableParentFunction: this.describeFeatureCallback
			}).handleBackground();
			this.updateFeatureArguments(this.feature, this.describeFeatureCallback);
		}
	}
	updateFeatureArguments(feature, featureArrowFunction) {
		const featureRequiredArgs = [
			feature.background !== null ? "Background" : void 0,
			feature.hasScenarioOutline ? "ScenarioOutline" : void 0,
			feature.hasScenario ? "Scenario" : void 0,
			feature.rules.length > 0 ? "Rule" : void 0
		].filter((a) => a !== void 0);
		this.updateSyntaxListChild(featureArrowFunction, featureRequiredArgs);
	}
	async formatAndSave() {
		this.sourceFile.formatText();
		await this.sourceFile.save();
	}
	get describeFeature() {
		return AstUtils.fromSourceFile(this.sourceFile).listDescendantCallExpressions().matchExpressionName("describeFeature").getOne();
	}
	get describeFeatureCallback() {
		if (this.describeFeature) return this.describeFeature.getArguments().find((arg) => arg.isKind(SyntaxKind.ArrowFunction));
	}
};
//#endregion
//#region src/plugin/index.ts
function VitestCucumberPlugin(options) {
	return {
		name: "vitest-cucumber-plugin",
		configureServer(server) {
			const featureDir = path.resolve(process.cwd(), options.featureFilesDir);
			fs.watch(featureDir, { recursive: true }, async (_, filename) => {
				if (filename?.endsWith(".feature")) {
					const featureFilePath = `${options.featureFilesDir}${filename}`;
					const specFilePath = featureFilePath.replace(".feature", ".spec.ts");
					try {
						if (fs.existsSync(specFilePath) === false) fs.writeFileSync(specFilePath, "");
						await FeatureAst.fromOptions({
							featureFilePath,
							specFilePath,
							onDeleteAction: options.onDeleteAction,
							formatCommand: options.formatCommand
						}).updateSpecFile();
					} catch (e) {
						console.error(e);
					}
					server.ws.send({
						type: "full-reload",
						path: "*"
					});
				}
			});
		}
	};
}
//#endregion
export { VitestCucumberPlugin };
