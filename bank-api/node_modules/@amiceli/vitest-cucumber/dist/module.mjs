import { f as defineParameterExpression, i as setVitestCucumberConfiguration, l as DefineFeature, n as defineSteps, r as getVitestCucumberConfiguration } from "./parser-C6SegF4O.mjs";
import { t as describeFeature } from "./describe-feature-CdxOfcs4.mjs";
import { n as loadFeatureFromText, t as loadFeature } from "./load-feature-CnOyTSNC.mjs";
//#region src/vitest/define-feature.ts
function wrapScenarioOutline(target, register) {
	const build = (variant) => {
		const fn = variant === "fn" ? target : target[variant];
		return (description, cb, examples) => {
			register(description, examples);
			fn(description, cb);
		};
	};
	return Object.assign(build("fn"), {
		skip: build("skip"),
		only: build("only")
	});
}
function defineFeature(featureName, describeFeatureCallback) {
	const feature = new DefineFeature(featureName, "Feature", true);
	const wrappedCallback = (params) => {
		const wrappedScenarioOutline = wrapScenarioOutline(params.ScenarioOutline, (description, examples) => feature.registerScenarioOutline(description, examples));
		const originalRule = params.Rule;
		const buildRule = (variant) => {
			const target = variant === "fn" ? originalRule : originalRule[variant];
			return (ruleName, ruleCallback) => {
				target(ruleName, (ruleOptions) => {
					const rule = feature.checkIfRuleExists(ruleName);
					ruleCallback({
						...ruleOptions,
						RuleScenarioOutline: wrapScenarioOutline(ruleOptions.RuleScenarioOutline, (description, examples) => rule.registerScenarioOutline(description, examples))
					});
				});
			};
		};
		const wrappedRule = Object.assign(buildRule("fn"), {
			skip: buildRule("skip"),
			only: buildRule("only")
		});
		describeFeatureCallback({
			...params,
			ScenarioOutline: wrappedScenarioOutline,
			Rule: wrappedRule
		});
	};
	return describeFeature(feature, wrappedCallback, {});
}
//#endregion
export { defineFeature, defineParameterExpression, defineSteps, describeFeature, getVitestCucumberConfiguration, loadFeature, loadFeatureFromText, setVitestCucumberConfiguration };
