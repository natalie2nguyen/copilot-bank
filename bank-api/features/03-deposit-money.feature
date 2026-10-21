Feature: Deposit money
  As a customer
  I want to deposit money into my account
  So that my balance increases

  Background:
    Given I am logged in as a customer
    And my checking balance is $100.00

  Scenario Outline: Deposit a valid amount
    When I deposit <amount>
    Then my deposit succeeds
    And my checking balance increases by exactly <amount>
    And a "DEPOSIT" transaction is recorded for <amount>
    And the transaction has a timestamp
    And the transaction records my resulting balance
    And the response contains my new balance and the transaction

    Examples:
      | amount      |
      | $0.01       |
      | $40.25      |
      | $10,000.00  |

  Scenario: Record an optional memo with a deposit
    When I deposit $25.00 with the memo "Paycheck"
    Then my deposit succeeds
    And the "DEPOSIT" transaction records the memo "Paycheck"

  Scenario Outline: Reject an amount outside the allowed deposit range
    When I deposit <amount>
    Then my deposit is rejected with status 400 and code "INVALID_AMOUNT"
    And my checking balance remains $100.00
    And no "DEPOSIT" transaction is recorded

    Examples:
      | amount      |
      | $0.00       |
      | -$0.01      |
      | $10,000.01  |

  Scenario: Show the new balance after a successful deposit
    Given I am on the deposit form
    When I submit a valid deposit
    Then I see a success message showing my new balance
