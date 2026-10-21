---
name: make-it-pass
description: Implement the smallest production change to pass one selected failing test
argument-hint: Select one failing test with #selection
---

Use the single failing test selected with `#selection` as the scope of this
task. Read its source feature scenario and the relevant production code and
project instructions before making changes.

Requirements:
- Implement only the production change needed to satisfy the selected test and
  its scenario.
- Do not edit tests, feature files, or weaken assertions. Do not implement
  behavior that is not specified by the scenario.
- Follow existing architecture and project conventions. Validate API input
  with zod before database access, keep balance-changing operations atomic,
  represent money as integer cents, and use the project's standard error
  response format where applicable.
- Avoid unrelated refactors and do not try to make other failing tests pass in
  this task.

Run the selected test after the change and report the result. If the test is
failing because of a test defect, missing prerequisite, or ambiguous scenario
rather than missing production behavior, do not modify the test; explain the
blocker instead.