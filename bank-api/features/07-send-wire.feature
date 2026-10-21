Feature: Send a wire
  As a customer
  I want to send money to another customer's account
  So that I can pay people

  Background:
    Given I am logged in as a customer

  Scenario: Send a wire successfully
    Given my checking balance is $500.00
    And another customer has account number "1234567890" and checking balance $100.00
    When I send $75.25 to account "1234567890" with the memo "Rent"
    Then my checking balance decreases by $75.25
    And the recipient's checking balance increases by $75.25
    And I have a "WIRE_OUT" transaction for $75.25
    And the recipient has a "WIRE_IN" transaction for $75.25
    And both transactions reference the same wire ID
    And the wire transactions include the memo "Rent"

  Scenario: Send a wire without an optional memo
    Given my checking balance is $500.00
    And another customer has account number "1234567890"
    When I send $75.25 to account "1234567890" without a memo
    Then the wire succeeds
    And I have a "WIRE_OUT" transaction
    And the recipient has a "WIRE_IN" transaction

  Scenario: Reject a wire to a nonexistent account
    Given my checking balance is $500.00
    When I send $75.25 to account "0000000000"
    Then my wire is rejected with status 404 and code "RECIPIENT_NOT_FOUND"
    And my checking balance remains $500.00
    And no "WIRE_OUT" transaction is recorded

  Scenario: Reject a wire to my own account
    Given I have a checking account
    When I send $75.25 to my own account
    Then my wire is rejected with status 400
    And my checking balance is unchanged
    And no wire transactions are recorded

  Scenario: Reject a wire when I have insufficient funds
    Given my checking balance is $50.00
    And another customer has account number "1234567890" and checking balance $100.00
    When I send $50.01 to account "1234567890"
    Then my wire is rejected with status 422 and code "INSUFFICIENT_FUNDS"
    And my checking balance remains $50.00
    And the recipient's checking balance remains $100.00
    And no wire transactions are recorded

  Scenario Outline: Reject a wire amount outside the allowed range
    Given I have a checking account
    When I send <amount> to another customer's account
    Then my wire is rejected with status 400 and code "INVALID_AMOUNT"
    And my checking balance is unchanged
    And no wire transactions are recorded

    Examples:
      | amount      |
      | $0.00       |
      | -$0.01      |
      | $10,000.01  |

  Scenario: Confirm a wire before submitting it
    Given I am on the wire form
    When I enter $75.25 and recipient account number "1234567890"
    Then I see a confirmation that says "Send $75.25 to account ••••1234?"
    And the wire has not been submitted
    When I confirm the wire
    Then the wire is submitted
