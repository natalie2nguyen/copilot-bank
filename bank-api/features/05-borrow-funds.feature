Feature: Borrow funds
  As a customer
  I want to borrow money against my credit line
  So that I can cover expenses when my balance is low

  Background:
    Given I am logged in as a customer

  Scenario: Borrow within the available credit
    Given my checking balance is $100.00
    And my loan balance is $0.00
    When I borrow $250.00
    Then my checking balance increases by $250.00
    And my loan balance increases by $250.00
    And a "LOAN_DRAW" transaction is recorded

  Scenario: Borrow the remaining available credit
    Given my loan balance is $4,750.00
    When I borrow $250.00
    Then my loan balance is $5,000.00
    And the borrow succeeds

  Scenario: Reject a borrow that exceeds the credit limit
    Given my checking balance is $100.00
    And my loan balance is $4,750.00
    When I borrow $250.01
    Then my borrow is rejected with status 422 and code "CREDIT_LIMIT_EXCEEDED"
    And my checking balance remains $100.00
    And my loan balance remains $4,750.00
    And no "LOAN_DRAW" transaction is recorded

  Scenario: Show available credit before borrowing
    Given my loan balance is $1,250.00
    When I view the borrow form
    Then I see available credit of $3,750.00

