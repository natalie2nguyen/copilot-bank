Feature: Withdraw money
  As a customer
  I want to withdraw money from my account
  So that I can use my funds

  Background:
    Given I am logged in as a customer

  Scenario Outline: Withdraw a valid amount
    Given my checking balance is $100.00
    When I withdraw <amount>
    Then my withdrawal succeeds
    And my checking balance decreases by exactly <amount>
    And a "WITHDRAWAL" transaction is recorded for <amount>

    Examples:
      | amount      |
      | $0.01       |
      | $40.25      |
      | $10,000.00  |

  Scenario Outline: Reject an amount outside the allowed withdrawal range
    Given my checking balance is $20,000.00
    When I withdraw <amount>
    Then my withdrawal is rejected with status 400 and code "INVALID_AMOUNT"
    And my checking balance remains $20,000.00
    And no "WITHDRAWAL" transaction is recorded

    Examples:
      | amount      |
      | $0.00       |
      | -$0.01      |
      | $10,000.01  |

  Scenario: Reject a withdrawal that exceeds my checking balance
    Given my checking balance is $25.00
    When I withdraw $25.01
    Then my withdrawal is rejected with status 422 and code "INSUFFICIENT_FUNDS"
    And my checking balance remains $25.00
    And no "WITHDRAWAL" transaction is recorded

  Scenario: Show insufficient-funds error on the withdraw form
    Given I am on the withdraw form
    And my checking balance is $25.00
    When I submit a withdrawal of $25.01
    Then I see a clear insufficient-funds error
    And my checking balance remains $25.00
