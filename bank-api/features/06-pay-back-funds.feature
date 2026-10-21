Feature: Pay back borrowed funds
  As a customer
  I want to repay my loan from my checking balance
  So that I reduce what I owe

  Background:
    Given I am logged in as a customer

  Scenario: Make a loan payment
    Given my checking balance is $500.00
    And my loan balance is $300.00
    When I pay back $100.00
    Then my checking balance decreases by $100.00
    And my loan balance decreases by $100.00
    And a "LOAN_PAYMENT" transaction is recorded

  Scenario: Reject a payment greater than the outstanding loan balance
    Given my checking balance is $500.00
    And my loan balance is $100.00
    When I pay back $100.01
    Then my payment is rejected with status 422 and code "OVERPAYMENT"
    And my checking balance remains $500.00
    And my loan balance remains $100.00
    And no "LOAN_PAYMENT" transaction is recorded

  Scenario: Reject a payment greater than the checking balance
    Given my checking balance is $100.00
    And my loan balance is $300.00
    When I pay back $100.01
    Then my payment is rejected with status 422 and code "INSUFFICIENT_FUNDS"
    And my checking balance remains $100.00
    And my loan balance remains $300.00
    And no "LOAN_PAYMENT" transaction is recorded

  Scenario: Reject a payment when there is no outstanding loan
    Given my loan balance is $0.00
    When I try to make a loan payment
    Then my payment is rejected with status 422 and code "NO_OUTSTANDING_LOAN"
    And my loan balance remains $0.00
    And no "LOAN_PAYMENT" transaction is recorded

  Scenario: Pay the full outstanding loan balance using the shortcut
    Given my checking balance is $500.00
    And my loan balance is $300.00
    When I select "Pay full balance"
    Then the payment amount is set to $300.00
    When I submit the payment
    Then my loan balance is $0.00
    And my checking balance is $200.00
    And a "LOAN_PAYMENT" transaction is recorded
