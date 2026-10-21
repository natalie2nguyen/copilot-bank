import { TestContext } from "vitest";

//#region src/parser/models/step.d.ts
declare enum StepTypes {
  THEN = "Then",
  AND = "And",
  WHEN = "When",
  GIVEN = "Given",
  BUT = "But",
  GENERIC = "Step"
}
type StepDataTanle = {
  [key: string]: string;
}[];
declare class Step {
  readonly type: StepTypes;
  readonly details: string;
  docStrings: string | null;
  isCalled: boolean;
  dataTables: StepDataTanle;
  readonly title: string;
  constructor(type: StepTypes, details: string, title?: string);
  getTitle(): string;
  setDocStrings(docStrings: string): void;
  matchStep(step: Step): boolean;
}
//#endregion
//#region src/parser/models/Taggable.d.ts
declare abstract class Taggable {
  tags: Set<string>;
  /**
   * Simple matching filter mostly following the cucumber expression tag rules,
   * e.g. `[["alpha", "beta"], "vitests", "another"]`
   * will be equivalent to:
    * (`@alpha` and `@beta`) or `@vitests` or `@another`
   */
  matchTags(filterItems: TagFilterItem[]): boolean;
  shouldBeCalled(options: TagFilters): boolean;
}
//#endregion
//#region src/parser/models/Stepable.d.ts
declare abstract class StepAble extends Taggable {
  abstract getTitle(): string;
  isCalled: boolean;
  private readonly _steps;
  protected readonly title: string;
  constructor(title: string);
  stepFailedExpressionMatch: {
    [key: string]: number;
  };
  findStepByTypeAndDetails(type: string, details: string): Step | undefined;
  hasUnCalledSteps(): boolean;
  getNoCalledStep(): Step | undefined;
  addStep(newStep: Step): void;
  checkIfStepWasCalled(): void;
  checkIfStepExists(stepType: string, stepDetails: string): Step;
  get lastStep(): Step;
  get steps(): Readonly<Step[]>;
}
//#endregion
//#region src/parser/models/scenario.d.ts
declare class Scenario extends StepAble {
  description: string;
  constructor(description: string, title?: string);
  getTitle(): string;
}
type Example = {
  [key: string]: any;
}[];
declare class ScenarioOutline extends Scenario {
  examples: Example;
  missingExamplesKeyword: boolean;
  constructor(description: string, title?: string);
  getStepTitle(step: Step, example: Example[0]): string;
  getStepDocStrings(step: Step, example: Example[0]): string | null;
}
//#endregion
//#region src/vitest/types.d.ts
type MaybePromise<T = void> = T | Promise<T>;
type CallbackWithSingleContext = (context: TestContext) => MaybePromise;
type CallbackWithParamsAndContext<T = any> = (ctx: TestContext, ...params: T[]) => MaybePromise;
type StepCallbackDefinition = (name: string, fn: CallbackWithSingleContext | CallbackWithParamsAndContext) => void;
type StepTest<T = any> = {
  Given: StepCallbackDefinition;
  When: StepCallbackDefinition;
  But: StepCallbackDefinition;
  And: StepCallbackDefinition;
  Then: StepCallbackDefinition;
  context: T;
};
type DefineStepsHandler = (callback: (defineStepsOptions: {
  Given: StepCallbackDefinition;
  When: StepCallbackDefinition;
  Then: StepCallbackDefinition;
  And: StepCallbackDefinition;
  But: StepCallbackDefinition;
  Step: StepCallbackDefinition;
}) => void) => void;
type FeatureDescriibeCallbackParams<T = any> = {
  Background: BackgroundTest & {
    skip: BackgroundTest;
  };
  Scenario: ScenarioTest & {
    skip: ScenarioTest;
    only: ScenarioTest;
  };
  ScenarioOutline: ScenarioOutlineTest & {
    skip: ScenarioOutlineTest;
    only: ScenarioOutlineTest;
  };
  BeforeAllScenarios: (fn: () => MaybePromise) => void;
  AfterAllScenarios: (fn: () => MaybePromise) => void;
  BeforeEachScenario: (fn: () => MaybePromise) => void;
  AfterEachScenario: (fn: () => MaybePromise) => void;
  Rule: RuleTest & {
    skip: RuleTest;
    only: RuleTest;
  }; /** should be called before Scenario, Rule, ScenarioOutline or Background */
  defineSteps: DefineStepsHandler;
  context: T;
};
type DescribeFeatureCallback = (scenarioCallback: FeatureDescriibeCallbackParams) => void;
type DefineRuleOptions<T = any> = Omit<RuleOptions<T>, 'RuleScenarioOutline'> & {
  RuleScenarioOutline: DefineScenarioOutlineTest & {
    skip: DefineScenarioOutlineTest;
    only: DefineScenarioOutlineTest;
  };
};
type DefineFeatureRuleTest = (ruleName: string, fn: (options: DefineRuleOptions) => void) => void;
type DefineScenarioOutlineTest = (scenarioDescription: string, fn: (options: StepTest, examples: Example[0]) => MaybePromise, examples: Example) => void;
type DefineFeatureCallback = (scenarioCallback: Omit<FeatureDescriibeCallbackParams, 'ScenarioOutline' | 'defineSteps' | 'Rule'> & {
  Rule: DefineFeatureRuleTest & {
    skip: DefineFeatureRuleTest;
    only: DefineFeatureRuleTest;
  };
  ScenarioOutline: DefineScenarioOutlineTest & {
    skip: DefineScenarioOutlineTest;
    only: DefineScenarioOutlineTest;
  };
}) => void;
type RuleOptions<T = any> = {
  RuleBackground: BackgroundTest & {
    skip: BackgroundTest;
  };
  RuleScenario: ScenarioTest & {
    skip: ScenarioTest;
    only: ScenarioTest;
  };
  RuleScenarioOutline: ScenarioOutlineTest & {
    skip: ScenarioOutlineTest;
    only: ScenarioOutlineTest;
  }; /** should be called before RuleScenario, RuleScenarioOutline or RuleBackground */
  defineSteps: DefineStepsHandler;
  context: T;
};
type RuleTest = (ruleName: string, fn: (options: RuleOptions) => void) => void;
type ScenarioTest = (scenarioDescription: string, fn: (options: StepTest) => MaybePromise) => void;
type ScenarioOutlineTest = (scenarioDescription: string, fn: (options: StepTest, examples: Example[0]) => MaybePromise) => void;
type BackgroundStepTest = Pick<StepTest, 'Given' | 'And' | 'context'>;
type BackgroundTest = (fn: (options: BackgroundStepTest) => MaybePromise) => void;
//#endregion
//#region src/vitest/describe/types.d.ts
type CompiledPattern = {
  regex: RegExp;
  originalPattern: string;
};
type ScenarioSteps = {
  key: string;
  fn: CallbackWithSingleContext | CallbackWithParamsAndContext;
  step: Step;
  params: unknown[];
  compiledPattern?: CompiledPattern;
};
//#endregion
//#region src/vitest/configuration.d.ts
type TagFilterItem = string | string[];
type TagFilters = {
  includeTags: TagFilterItem[];
  excludeTags: TagFilterItem[];
};
type VitestCucumberOptions = {
  language?: string;
  includeTags?: TagFilterItem[];
  excludeTags?: TagFilterItem[];
  predefinedSteps: ScenarioSteps[];
  mappedExamples: {
    [key: string]: unknown;
  };
  onStepError?: (args: {
    error: Error;
    ctx: TestContext;
    step: Step;
  }) => void;
};
type RequiredVitestCucumberOptions = Required<VitestCucumberOptions>;
declare const getVitestCucumberConfiguration: (options?: Omit<VitestCucumberOptions, "predefinedSteps" | "mappedExamples">) => RequiredVitestCucumberOptions;
declare const setVitestCucumberConfiguration: (options: VitestCucumberOptions) => void;
declare const defineSteps: DefineStepsHandler;
//#endregion
//#region src/parser/models/Background.d.ts
declare class Background extends StepAble {
  constructor(title?: string);
  getTitle(): string;
  addStep(step: Step): void;
}
//#endregion
//#region src/parser/models/ScenarioParent.d.ts
declare abstract class ScenarioParent extends Taggable {
  readonly name: string;
  description: string;
  private readonly _scenarii;
  background: Background | null;
  protected readonly title: string;
  protected constructor(name: string, title: string);
  addScenario(newScenario: Scenario | ScenarioOutline): void;
  getScenarioByName(name: string): Scenario | ScenarioOutline | undefined;
  getScenarioExample(name: string): Example | null;
  getFirstNotCalledScenario(options: RequiredDescribeFeatureOptions): Scenario | ScenarioOutline | undefined;
  haveAlreadyCalledScenario(): boolean;
  getTitle(): string;
  checkUncalledScenario(options: RequiredDescribeFeatureOptions): this;
  checkUncalledBackground(options: RequiredDescribeFeatureOptions): this;
  getBackground(): Background;
  private checkIfScenarioExists;
  private scenarioShouldNotBeOutline;
  private scenarioShouldBeOutline;
  getScenario(description: string): Scenario;
  getScenarioOutline(description: string): ScenarioOutline;
  mustHaveScenario(): void;
  get hasScenarioOutline(): boolean;
  get hasScenario(): boolean;
  get scenarii(): Readonly<Scenario[]>;
}
//#endregion
//#region src/parser/models/Rule.d.ts
declare class Rule extends ScenarioParent {
  isCalled: boolean;
  constructor(name: string, title?: string);
}
//#endregion
//#region src/parser/models/feature.d.ts
declare class Feature extends ScenarioParent {
  private readonly _rules;
  readonly withoutGherkin: boolean;
  constructor(name: string, title?: string, withoutGherkin?: boolean);
  getRuleByName(name: string): Rule | undefined;
  getFirstRuleNotCalled(options: RequiredDescribeFeatureOptions): Rule | undefined;
  haveAlreadyCalledRule(): boolean;
  checkUncalledRule(options: RequiredDescribeFeatureOptions): this;
  checkIfRuleExists(ruleName: string): Rule;
  mustHaveScenarioOrRules(): void;
  addRule(newRule: Rule): void;
  get rules(): Readonly<Rule[]>;
}
//#endregion
//#region src/vitest/describe-feature.d.ts
type DescribeFeatureOptions = Pick<VitestCucumberOptions, 'includeTags' | 'excludeTags'>;
type RequiredDescribeFeatureOptions = Required<DescribeFeatureOptions>;
declare function describeFeature(feature: Feature, describeFeatureCallback: DescribeFeatureCallback, describeFeatureOptions?: DescribeFeatureOptions): void;
//#endregion
//#region src/parser/parser.d.ts
type ParserOptions = Pick<VitestCucumberOptions, 'language'>;
type RequiredParserOptions = Pick<RequiredVitestCucumberOptions, 'language'>;
//#endregion
export { VitestCucumberOptions as a, setVitestCucumberConfiguration as c, StepTest as d, Feature as i, DefineFeatureCallback as l, RequiredParserOptions as n, defineSteps as o, describeFeature as r, getVitestCucumberConfiguration as s, ParserOptions as t, FeatureDescriibeCallbackParams as u };