---
name: feature-to-tests
description: Generate failing tests for every scenario in the current Gherkin feature file
argument-hint: Attach the feature file with #file
---

Use the feature file attached with `#file` as the source of truth. Inspect the
project's test files, scripts, fixtures, and step definitions first, then add
tests in the existing test structure.

Requirements:
- Name the test file after the feature file: remove a leading story-number
  prefix such as `01-`, keep the remaining kebab-case feature name, and append
  `.test.ts`. For example, `01-register.feature` maps to
  `tests/register.test.ts`, and `02-manage-account.feature` maps to
  `tests/manage-account.test.ts`. Do not use a generic filename such as
  `auth.test.ts` or `profile.test.ts`.
- If the corresponding feature test file already exists, add the new scenario
  tests to it rather than creating a duplicate.
- Create a test for every scenario and every `Examples` row in each
  `Scenario Outline`.
- Prefer the project's configured Gherkin runner (`@amiceli/vitest-cucumber`)
  and reuse existing step definitions and fixtures. If the project uses plain
  Vitest tests instead, create one test per scenario and identify its source
  scenario in a comment.
- Write tests against the existing application or public API behavior. Do not
  change production code, the feature file, or existing tests to make the new
  tests pass.
- Make tests fail for the missing or incorrect behavior, not because of
  syntax, setup, or import errors. Use existing project helpers; represent
  money in assertions as integer cents.
- Do not add behavior that is not specified by the feature file.

Run the generated tests. Report which tests fail and confirm that each failure
is due to the behavior under test. If a test fails for an unrelated setup or
syntax problem, fix only the newly generated test code and rerun it; do not
alter production code or the feature file.