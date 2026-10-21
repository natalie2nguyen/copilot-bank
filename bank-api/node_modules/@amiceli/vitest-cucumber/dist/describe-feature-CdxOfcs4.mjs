import { _ as ScenarioOulineWithoutExamplesError, a as defineSharedStep, c as updatePredefinedStepsAccordingLevel, d as ScenarioOutline, g as MissingScenarioOutlineVariableValueError, o as defineStepToTest, p as ExpressionStep, r as getVitestCucumberConfiguration, s as orderStepsToRun, u as DefineScenarioOutline, v as ScenarioOutlineVariableNotCalledInStepsError, y as ScenarioOutlineVariablesDeclaredWithoutExamplesError } from "./parser-C6SegF4O.mjs";
import { afterAll, beforeAll, describe, onTestFailed, test } from "vitest";
//#region src/vitest/describe/describe-background.ts
function createBackgroundDescribeHandler({ background, predefinedSteps, backgroundCallback }) {
	let backgroundStepsToRun = [];
	const config = getVitestCucumberConfiguration();
	const createScenarioStepCallback = (stepType) => {
		return (stepDetails, scenarioStepCallback) => {
			backgroundStepsToRun.push(defineStepToTest({
				parent: background,
				stepDetails,
				stepType,
				scenarioStepCallback
			}));
		};
	};
	backgroundCallback({
		Given: createScenarioStepCallback(`Given`),
		And: createScenarioStepCallback(`And`),
		context: {}
	});
	const missingSteps = background.steps.filter((step) => {
		return backgroundStepsToRun.find((s) => {
			return step.matchStep(s.step);
		}) === void 0;
	});
	for (const predefineStep of predefinedSteps) {
		const matchingSteps = missingSteps.filter((featureStep) => {
			if (predefineStep.step.type === "Step") {
				if (featureStep.details === predefineStep.step.details) return true;
				if (predefineStep.compiledPattern) {
					predefineStep.compiledPattern.regex.lastIndex = 0;
					return predefineStep.compiledPattern.regex.test(featureStep.details);
				}
				return false;
			}
			if (featureStep.type !== predefineStep.step.type) return false;
			if (featureStep.details === predefineStep.step.details) return true;
			if (predefineStep.compiledPattern) {
				predefineStep.compiledPattern.regex.lastIndex = 0;
				return predefineStep.compiledPattern.regex.test(featureStep.details);
			}
			return false;
		});
		for (const missingStep of matchingSteps) {
			const params = ExpressionStep.matchStep(missingStep, predefineStep.step.details);
			backgroundStepsToRun.push({
				key: missingStep.getTitle(),
				fn: predefineStep.fn,
				step: missingStep,
				params: [
					...params,
					missingStep.dataTables.length > 0 ? missingStep.dataTables : null,
					missingStep.docStrings
				].filter((p) => p !== null)
			});
			missingStep.isCalled = true;
		}
	}
	backgroundStepsToRun = orderStepsToRun(background, backgroundStepsToRun);
	background.checkIfStepWasCalled();
	return function backgroundDescribe() {
		test.for(backgroundStepsToRun.map((s) => {
			return [s.key, s];
		}))(`%s`, async ([, scenarioStep], ctx) => {
			onTestFailed(({ task }) => {
				const message = task.result?.errors?.at(0)?.message;
				config.onStepError({
					error: new Error(message || `${scenarioStep.step.details} failed`),
					ctx,
					step: scenarioStep.step
				});
			});
			await scenarioStep.fn(ctx, ...scenarioStep.params);
		});
	};
}
//#endregion
//#region src/vitest/describe/describe-scenario.ts
function createScenarioDescribeHandler({ scenario, predefinedSteps, scenarioTestCallback, afterEachScenarioHook, beforeEachScenarioHook }) {
	let scenarioStepsToRun = [];
	const config = getVitestCucumberConfiguration();
	const createScenarioStepCallback = (stepType) => {
		return (stepDetails, scenarioStepCallback) => {
			scenarioStepsToRun.push(defineStepToTest({
				parent: scenario,
				stepDetails,
				stepType,
				scenarioStepCallback
			}));
		};
	};
	scenarioTestCallback({
		Given: createScenarioStepCallback(`Given`),
		When: createScenarioStepCallback(`When`),
		And: createScenarioStepCallback(`And`),
		Then: createScenarioStepCallback(`Then`),
		But: createScenarioStepCallback(`But`),
		context: {}
	});
	const missingSteps = scenario.steps.filter((step) => {
		return scenarioStepsToRun.find((s) => {
			return step.matchStep(s.step);
		}) === void 0;
	});
	for (const predefineStep of predefinedSteps) {
		const matchingSteps = missingSteps.filter((featureStep) => {
			if (predefineStep.step.type === "Step") {
				if (featureStep.details === predefineStep.step.details) return true;
				if (predefineStep.compiledPattern) {
					predefineStep.compiledPattern.regex.lastIndex = 0;
					return predefineStep.compiledPattern.regex.test(featureStep.details);
				}
				return false;
			}
			if (featureStep.type !== predefineStep.step.type) return false;
			if (featureStep.details === predefineStep.step.details) return true;
			if (predefineStep.compiledPattern) {
				predefineStep.compiledPattern.regex.lastIndex = 0;
				return predefineStep.compiledPattern.regex.test(featureStep.details);
			}
			return false;
		});
		for (const missingStep of matchingSteps) {
			const params = ExpressionStep.matchStep(missingStep, predefineStep.step.details);
			scenarioStepsToRun.push({
				key: missingStep.getTitle(),
				fn: predefineStep.fn,
				step: missingStep,
				params: [
					...params,
					missingStep.dataTables.length > 0 ? missingStep.dataTables : null,
					missingStep.docStrings
				].filter((p) => p !== null)
			});
			missingStep.isCalled = true;
		}
	}
	scenarioStepsToRun = orderStepsToRun(scenario, scenarioStepsToRun);
	scenario.checkIfStepWasCalled();
	return function scenarioDescribe() {
		beforeAll(async () => {
			await beforeEachScenarioHook();
		});
		afterAll(async () => {
			await afterEachScenarioHook();
		});
		test.for(scenarioStepsToRun.map((s) => {
			return [s.key, s];
		}))(`%s`, async ([, scenarioStep], ctx) => {
			onTestFailed(({ task }) => {
				const message = task.result?.errors?.at(0)?.message;
				config.onStepError({
					error: new Error(message || `${scenarioStep.step.details} failed`),
					ctx,
					step: scenarioStep.step
				});
			});
			await scenarioStep.fn(ctx, ...scenarioStep.params);
		});
	};
}
//#endregion
//#region src/vitest/describe/describe-scenario-outline.ts
function createScenarioOutlineDescribeHandler({ scenario, predefinedSteps, mappedExamples, scenarioTestCallback, afterEachScenarioHook, beforeEachScenarioHook }) {
	let scenarioStepsToRun = [];
	const config = getVitestCucumberConfiguration();
	function addPredefinedSteps(list, exampleVars) {
		const missingSteps = scenario.steps.filter((step) => {
			return scenarioStepsToRun.find((s) => {
				return step.matchStep(s.step);
			}) === void 0;
		});
		for (const predefineStep of list) {
			const matchingSteps = missingSteps.filter((featureStep) => {
				if (featureStep.type !== predefineStep.step.type) return false;
				if (featureStep.details === predefineStep.step.details) return true;
				if (predefineStep.compiledPattern) {
					predefineStep.compiledPattern.regex.lastIndex = 0;
					return predefineStep.compiledPattern.regex.test(featureStep.details);
				}
				return false;
			});
			for (const missingStep of matchingSteps) {
				const substitutedParams = ExpressionStep.matchStep(missingStep, predefineStep.step.details).map((param) => {
					if (typeof param === "string") {
						let result = param;
						for (const [key, value] of Object.entries(exampleVars)) result = result.replace(`<${key}>`, String(value));
						return result;
					}
					return param;
				});
				scenarioStepsToRun.push({
					key: missingStep.getTitle(),
					fn: predefineStep.fn,
					step: missingStep,
					params: [
						...substitutedParams,
						missingStep.dataTables.length > 0 ? missingStep.dataTables : null,
						missingStep.docStrings
					].filter((p) => p !== null)
				});
				missingStep.isCalled = true;
			}
		}
		scenarioStepsToRun = orderStepsToRun(scenario, scenarioStepsToRun);
	}
	const createScenarioStepCallback = (stepType) => {
		return (stepDetails, scenarioStepCallback) => {
			scenarioStepsToRun.push(defineStepToTest({
				parent: scenario,
				stepDetails,
				stepType,
				scenarioStepCallback
			}));
		};
	};
	const scenarioStepsCallback = {
		Given: createScenarioStepCallback(`Given`),
		When: createScenarioStepCallback(`When`),
		And: createScenarioStepCallback(`And`),
		Then: createScenarioStepCallback(`Then`),
		But: createScenarioStepCallback(`But`),
		context: {}
	};
	const example = scenario.examples;
	if (example) return example?.map((exampleVariables) => {
		const mappedExampleVariables = Object.fromEntries(Object.entries(exampleVariables).map(([index, value]) => {
			return [index, mappedExamples[value] ?? value];
		}));
		scenarioStepsToRun = [];
		scenarioTestCallback(scenarioStepsCallback, mappedExampleVariables);
		addPredefinedSteps(predefinedSteps, mappedExampleVariables);
		scenario.checkIfStepWasCalled();
		return ((steps) => function scenarioOutlineDescribe() {
			beforeAll(async () => {
				await beforeEachScenarioHook();
			});
			afterAll(async () => {
				await afterEachScenarioHook();
			});
			test.for(steps.map((s) => {
				return [scenario.getStepTitle(s.step, exampleVariables), s];
			}))(`%s`, async ([, scenarioStep], ctx) => {
				if (scenarioStep.step.docStrings) scenarioStep.params[scenarioStep.params.length - 1] = scenario.getStepDocStrings(scenarioStep.step, mappedExampleVariables);
				onTestFailed(({ task }) => {
					const message = task.result?.errors?.at(0)?.message;
					config.onStepError({
						error: new Error(message || `${scenarioStep.step.details} failed`),
						ctx,
						step: scenarioStep.step
					});
				});
				await scenarioStep.fn(ctx, ...scenarioStep.params);
			});
		})([...scenarioStepsToRun]);
	});
	return [];
}
//#endregion
//#region src/vitest/describe/handle-skip-only.ts
function defineRuleScenarioToRun(options) {
	const describeToRun = options.describes.filter((d) => !d.skipped && !d.only);
	const describeToSkip = options.describes.filter((d) => d.skipped && !d.only);
	const onlyDescribeToRun = options.describes.filter((d) => !d.skipped && d.only);
	const finalDescribesToRun = [];
	for (const toRun of describeToRun) {
		if (options.featureBackground) if (options.featureBackground.skipped) describeToSkip.push(options.featureBackground);
		else finalDescribesToRun.push(options.featureBackground);
		if (options.ruleBackground) if (options.ruleBackground.skipped) describeToSkip.push(options.ruleBackground);
		else finalDescribesToRun.push(options.ruleBackground);
		finalDescribesToRun.push(toRun);
	}
	return {
		describeToRun: finalDescribesToRun,
		describeToSkip,
		onlyDescribeToRun
	};
}
function defineScenarioToRun(options) {
	const describeToRun = options.describes.filter((d) => !d.skipped && !d.only);
	const describeToSkip = options.describes.filter((d) => d.skipped && !d.only);
	const onlyDescribeToRun = options.describes.filter((d) => !d.skipped && d.only);
	const finalDescribesToRun = [];
	for (const toRun of describeToRun) {
		if (options.featureBackground) if (options.featureBackground.skipped) describeToSkip.push(options.featureBackground);
		else finalDescribesToRun.push(options.featureBackground);
		finalDescribesToRun.push(toRun);
	}
	describeToSkip.push(...options.describeRules.filter((s) => s.skipped && !s.only));
	finalDescribesToRun.push(...options.describeRules.filter((s) => !s.skipped && !s.only));
	onlyDescribeToRun.push(...options.describeRules.filter((s) => !s.skipped && s.only));
	return {
		describeToRun: finalDescribesToRun,
		describeToSkip,
		onlyDescribeToRun
	};
}
//#endregion
//#region src/vitest/state-detectors/ScenarioStateDetector.ts
var ScenarioStateDetector = class ScenarioStateDetector {
	scenario;
	constructor(scenario) {
		this.scenario = scenario;
	}
	static forScenario(scenario) {
		return new ScenarioStateDetector(scenario);
	}
	checkIfScenarioHasNoExample() {
		const { examples } = this.scenario;
		if (examples.length === 0) throw new ScenarioOulineWithoutExamplesError(this.scenario);
	}
	detectMissingVariableInSteps() {
		const { examples } = this.scenario;
		const missingVariable = Object.keys(examples[0]).find((v) => {
			return this.scenario.steps.map((s) => s.details).join(``).includes(`<${v}>`) === false;
		});
		if (missingVariable) throw new ScenarioOutlineVariableNotCalledInStepsError(this.scenario, missingVariable);
	}
	detectMissingVariableValue() {
		const { examples } = this.scenario;
		const missingVariable = Object.keys(examples[0]).find((v) => {
			return examples.filter((values) => {
				return values[v] === void 0 || values[v] === null;
			}).length > 0;
		});
		if (missingVariable) throw new MissingScenarioOutlineVariableValueError(this.scenario, missingVariable);
	}
	checkExemples() {
		if (this.scenario instanceof ScenarioOutline) {
			if (this.scenario.missingExamplesKeyword) throw new ScenarioOutlineVariablesDeclaredWithoutExamplesError(this.scenario);
			this.checkIfScenarioHasNoExample();
			if (!(this.scenario instanceof DefineScenarioOutline)) this.detectMissingVariableInSteps();
			this.detectMissingVariableValue();
		}
	}
};
//#endregion
//#region src/vitest/describe-feature.ts
/**
* Extract tag filters by removing the `@` prefix if present
*/
const extractTagFilters = (filterItems) => {
	return filterItems.map((filterItem) => {
		if (Array.isArray(filterItem)) return extractTagFilters(filterItem);
		if (filterItem.startsWith("@")) return filterItem.replace("@", "");
		return filterItem;
	});
};
function describeFeature(feature, describeFeatureCallback, describeFeatureOptions) {
	let beforeAllScenarioHook = () => {};
	let beforeEachScenarioHook = () => {};
	let afterAllScenarioHook = () => {};
	let afterEachScenarioHook = () => {};
	const configuration = getVitestCucumberConfiguration();
	const options = {
		includeTags: extractTagFilters(describeFeatureOptions?.includeTags || configuration.includeTags),
		excludeTags: extractTagFilters(describeFeatureOptions?.excludeTags || configuration.excludeTags),
		predefinedSteps: [],
		predefinedRuleSteps: []
	};
	const describeScenarios = [];
	const describeRules = [];
	let describeBackground = null;
	describeFeatureCallback({
		Background: (() => {
			const createBackgroundHandler = (backgroundCallback, skipped) => {
				const background = feature.getBackground();
				background.isCalled = true;
				describeBackground = {
					only: false,
					skipped: skipped ?? !background.shouldBeCalled(options),
					describeTitle: background.getTitle(),
					describeHandler: createBackgroundDescribeHandler({
						background,
						predefinedSteps: updatePredefinedStepsAccordingLevel({
							globallyPredefinedSteps: configuration.predefinedSteps,
							featurePredefinedSteps: options.predefinedSteps,
							rulePredefinedSteps: []
						}),
						backgroundCallback
					})
				};
			};
			const fn = (backgroundCallback) => {
				createBackgroundHandler(backgroundCallback);
			};
			fn.skip = (backgroundCallback) => {
				createBackgroundHandler(backgroundCallback, true);
			};
			return fn;
		})(),
		Scenario: (() => {
			const createScenarioHandler = (scenarioDescription, scenarioTestCallback, only, skipped) => {
				const scenario = feature.getScenario(scenarioDescription);
				scenario.isCalled = true;
				describeScenarios.push({
					skipped: skipped ?? !scenario.shouldBeCalled(options),
					only,
					describeTitle: scenario.getTitle(),
					describeHandler: createScenarioDescribeHandler({
						scenario,
						predefinedSteps: updatePredefinedStepsAccordingLevel({
							globallyPredefinedSteps: configuration.predefinedSteps,
							featurePredefinedSteps: options.predefinedSteps,
							rulePredefinedSteps: []
						}),
						scenarioTestCallback,
						beforeEachScenarioHook,
						afterEachScenarioHook
					})
				});
			};
			const fn = (scenarioDescription, scenarioTestCallback) => createScenarioHandler(scenarioDescription, scenarioTestCallback, false);
			fn.skip = (scenarioDescription, scenarioTestCallback) => createScenarioHandler(scenarioDescription, scenarioTestCallback, false, true);
			fn.only = (scenarioDescription, scenarioTestCallback) => createScenarioHandler(scenarioDescription, scenarioTestCallback, true, false);
			return fn;
		})(),
		ScenarioOutline: (() => {
			const createScenarioOutlineHandler = (scenarioDescription, scenarioTestCallback, only, skipped) => {
				const scenario = feature.getScenarioOutline(scenarioDescription);
				ScenarioStateDetector.forScenario(scenario).checkExemples();
				scenario.isCalled = true;
				describeScenarios.push(...createScenarioOutlineDescribeHandler({
					scenario,
					mappedExamples: configuration.mappedExamples,
					predefinedSteps: updatePredefinedStepsAccordingLevel({
						globallyPredefinedSteps: configuration.predefinedSteps,
						featurePredefinedSteps: options.predefinedSteps,
						rulePredefinedSteps: []
					}),
					scenarioTestCallback,
					beforeEachScenarioHook,
					afterEachScenarioHook
				}).map((t) => ({
					only,
					skipped: skipped ?? !scenario.shouldBeCalled(options),
					describeTitle: scenario.getTitle(),
					describeHandler: t
				})));
			};
			const fn = (scenarioDescription, scenarioTestCallback) => {
				createScenarioOutlineHandler(scenarioDescription, scenarioTestCallback, false);
			};
			fn.skip = (scenarioDescription, scenarioTestCallback) => {
				createScenarioOutlineHandler(scenarioDescription, scenarioTestCallback, false, true);
			};
			fn.only = (scenarioDescription, scenarioTestCallback) => {
				createScenarioOutlineHandler(scenarioDescription, scenarioTestCallback, true, false);
			};
			return fn;
		})(),
		Rule: (() => {
			const createRuleHandler = (ruleName, describeRuleCallback, ruleOnly, ruleSkipped) => {
				const describeRuleScenarios = [];
				const currentRule = feature.checkIfRuleExists(ruleName);
				currentRule.isCalled = true;
				let describeRuleBackground = null;
				describeRuleCallback({
					RuleBackground: (() => {
						const createRuleBackgroundHandler = (backgroundCallback, skipped) => {
							const background = currentRule.getBackground();
							background.isCalled = true;
							describeRuleBackground = {
								skipped: skipped ?? !background.shouldBeCalled(options),
								only: false,
								describeTitle: background.getTitle(),
								describeHandler: createBackgroundDescribeHandler({
									background,
									predefinedSteps: updatePredefinedStepsAccordingLevel({
										globallyPredefinedSteps: configuration.predefinedSteps,
										featurePredefinedSteps: options.predefinedSteps,
										rulePredefinedSteps: options.predefinedRuleSteps
									}),
									backgroundCallback
								})
							};
						};
						const fn = (backgroundCallback) => {
							createRuleBackgroundHandler(backgroundCallback);
						};
						fn.skip = (backgroundCallback) => {
							createRuleBackgroundHandler(backgroundCallback, true);
						};
						return fn;
					})(),
					RuleScenario: (() => {
						const createRuleScenarioHandler = (scenarioDescription, scenarioTestCallback, only, skipped) => {
							const scenario = currentRule.getScenario(scenarioDescription);
							scenario.isCalled = true;
							describeRuleScenarios.push({
								describeTitle: scenario.getTitle(),
								skipped: skipped ?? !scenario.shouldBeCalled(options),
								only,
								describeHandler: createScenarioDescribeHandler({
									scenario,
									predefinedSteps: updatePredefinedStepsAccordingLevel({
										globallyPredefinedSteps: configuration.predefinedSteps,
										featurePredefinedSteps: options.predefinedSteps,
										rulePredefinedSteps: options.predefinedRuleSteps
									}),
									scenarioTestCallback,
									beforeEachScenarioHook,
									afterEachScenarioHook
								})
							});
						};
						const fn = (scenarioDescription, scenarioTestCallback) => {
							createRuleScenarioHandler(scenarioDescription, scenarioTestCallback, false);
						};
						fn.skip = (scenarioDescription, scenarioTestCallback) => {
							createRuleScenarioHandler(scenarioDescription, scenarioTestCallback, false, true);
						};
						fn.only = (scenarioDescription, scenarioTestCallback) => {
							createRuleScenarioHandler(scenarioDescription, scenarioTestCallback, true, false);
						};
						return fn;
					})(),
					RuleScenarioOutline: (() => {
						const createRuleScenarioOutlineHandler = (scenarioDescription, scenarioTestCallback, only, skipped) => {
							const scenario = currentRule.getScenarioOutline(scenarioDescription);
							ScenarioStateDetector.forScenario(scenario).checkExemples();
							scenario.isCalled = true;
							describeRuleScenarios.push(...createScenarioOutlineDescribeHandler({
								scenario,
								mappedExamples: configuration.mappedExamples,
								predefinedSteps: updatePredefinedStepsAccordingLevel({
									globallyPredefinedSteps: configuration.predefinedSteps,
									featurePredefinedSteps: options.predefinedSteps,
									rulePredefinedSteps: options.predefinedRuleSteps
								}),
								scenarioTestCallback,
								beforeEachScenarioHook,
								afterEachScenarioHook
							}).map((t) => ({
								skipped: skipped ?? !scenario.shouldBeCalled(options),
								only,
								describeTitle: scenario.getTitle(),
								describeHandler: t
							})));
						};
						const fn = (scenarioDescription, scenarioTestCallback) => {
							createRuleScenarioOutlineHandler(scenarioDescription, scenarioTestCallback, false);
						};
						fn.skip = (scenarioDescription, scenarioTestCallback) => {
							createRuleScenarioOutlineHandler(scenarioDescription, scenarioTestCallback, false, true);
						};
						fn.only = (scenarioDescription, scenarioTestCallback) => {
							createRuleScenarioOutlineHandler(scenarioDescription, scenarioTestCallback, true, false);
						};
						return fn;
					})(),
					context: {},
					defineSteps: (defineStepsCallback) => {
						defineStepsCallback({
							Given: (name, callback) => {
								options.predefinedRuleSteps.push(defineSharedStep("Given", name, callback));
							},
							And: (name, callback) => {
								options.predefinedRuleSteps.push(defineSharedStep("And", name, callback));
							},
							Then: (name, callback) => {
								options.predefinedRuleSteps.push(defineSharedStep("Then", name, callback));
							},
							When: (name, callback) => {
								options.predefinedRuleSteps.push(defineSharedStep("When", name, callback));
							},
							But: (name, callback) => {
								options.predefinedRuleSteps.push(defineSharedStep("But", name, callback));
							},
							Step: (name, callback) => {
								options.predefinedRuleSteps.push(defineSharedStep("Step", name, callback));
							}
						});
					}
				});
				currentRule.checkUncalledScenario(options).checkUncalledBackground(options);
				describeRules.push({
					skipped: ruleSkipped ?? !currentRule.shouldBeCalled(options),
					only: ruleOnly,
					describeTitle: currentRule.getTitle(),
					describeHandler: function describeRule() {
						beforeAll(async () => {
							await beforeAllScenarioHook();
						});
						afterAll(async () => {
							await afterAllScenarioHook();
						});
						const { describeToRun, describeToSkip, onlyDescribeToRun } = defineRuleScenarioToRun({
							describes: describeRuleScenarios,
							ruleBackground: describeRuleBackground,
							featureBackground: describeBackground
						});
						describe.only.each(onlyDescribeToRun.map((s) => {
							return [s.describeTitle, s];
						}))(`%s`, (_, { describeHandler }) => {
							describeHandler();
						});
						describe.skip.each(describeToSkip.map((s) => {
							return [s.describeTitle, s];
						}))(`%s`, (_, { describeHandler }) => {
							describeHandler();
						});
						describe.each(describeToRun.map((s) => {
							return [s.describeTitle, s];
						}))(`%s`, (_, { describeHandler }) => {
							describeHandler();
						});
					}
				});
			};
			const fn = (ruleName, describeRuleCallback) => {
				createRuleHandler(ruleName, describeRuleCallback, false);
			};
			fn.skip = (ruleName, describeRuleCallback) => {
				createRuleHandler(ruleName, describeRuleCallback, false, true);
			};
			fn.only = (ruleName, describeRuleCallback) => {
				createRuleHandler(ruleName, describeRuleCallback, true, false);
			};
			return fn;
		})(),
		BeforeEachScenario: (fn) => {
			beforeEachScenarioHook = fn;
		},
		BeforeAllScenarios: (fn) => {
			beforeAllScenarioHook = fn;
		},
		AfterAllScenarios: (fn) => {
			afterAllScenarioHook = fn;
		},
		AfterEachScenario: (fn) => {
			afterEachScenarioHook = fn;
		},
		defineSteps: (defineStepsCallback) => {
			defineStepsCallback({
				Given: (name, callback) => {
					options.predefinedSteps.push(defineSharedStep("Given", name, callback));
				},
				And: (name, callback) => {
					options.predefinedSteps.push(defineSharedStep("And", name, callback));
				},
				Then: (name, callback) => {
					options.predefinedSteps.push(defineSharedStep("Then", name, callback));
				},
				When: (name, callback) => {
					options.predefinedSteps.push(defineSharedStep("When", name, callback));
				},
				But: (name, callback) => {
					options.predefinedSteps.push(defineSharedStep("But", name, callback));
				},
				Step: (name, callback) => {
					options.predefinedSteps.push(defineSharedStep("Step", name, callback));
				}
			});
		},
		context: {}
	});
	feature.checkUncalledRule(options).checkUncalledScenario(options).checkUncalledBackground(options);
	describe(feature.getTitle(), async () => {
		beforeAll(async () => {
			await beforeAllScenarioHook();
		});
		afterAll(async () => {
			await afterAllScenarioHook();
		});
		const { describeToRun, describeToSkip, onlyDescribeToRun } = defineScenarioToRun({
			describes: describeScenarios,
			featureBackground: describeBackground,
			describeRules
		});
		describe.only.each(onlyDescribeToRun.map((s) => {
			return [s.describeTitle, s];
		}))(`%s`, (_, { describeHandler }) => {
			describeHandler();
		});
		describe.skip.each(describeToSkip.map((s) => {
			return [s.describeTitle, s];
		}))(`%s`, (_, { describeHandler }) => {
			describeHandler();
		});
		describe.each(describeToRun.map((s) => {
			return [s.describeTitle, s];
		}))(`%s`, (_, parent) => {
			parent.describeHandler();
		});
	});
}
//#endregion
export { describeFeature as t };
