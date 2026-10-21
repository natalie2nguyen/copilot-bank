---
name: write-feature
description: Draft a Gherkin feature file from a banking user story and its acceptance criteria
argument-hint: Paste the user story and acceptance criteria
---

Turn the user story and acceptance criteria provided in the chat into a Gherkin
feature file.

Before writing, check existing files in `bank-api/features/` for naming and
style conventions. Create one file there using the next appropriate story
number and a short kebab-case name, such as `NN-story-name.feature`.

Requirements:
- Preserve the intent and scope of the supplied story and acceptance criteria.
- Include at least one scenario for every acceptance criterion.
- Describe observable behavior in declarative language; do not specify HTTP
  methods, routes, database details, or other implementation choices.
- Use `Scenario Outline` with examples for related boundary or input cases.
- Follow the existing feature-file style. Express money as currency in Gherkin
  steps (for example, `$12.34`).
- Do not invent business rules or behavior that is not in the story,
  acceptance criteria, or existing project specifications. If a requirement is
  ambiguous or contradictory, ask for clarification rather than guessing.

After creating the draft, summarize the scenarios and map each acceptance
criterion to the scenario(s) that cover it. The feature file is a draft for the
student to review.