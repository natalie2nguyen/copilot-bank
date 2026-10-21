Feature: Get current account balance
  As a customer
  I want to see my current checking balance
  So that I know how much I have available

  Background:
    Given I am logged in as a customer

  Scenario: Return the checking balance in cents and formatted currency
    Given my checking balance is $1,234.56
    When I request my current checking balance
    Then the response contains a balance of 123456 cents
    And the response contains the formatted balance "$1,234.56"

  Scenario: Balance equals the sum of transaction effects
    Given I have completed a mix of deposits, withdrawals, loan draws, loan payments, and wires
    When I request my current checking balance
    Then my balance equals the sum of my checking transaction effects

  Scenario: Show the current balance on the dashboard
    Given I am on the dashboard
    When my current checking balance is $1,234.56
    Then the dashboard prominently shows "$1,234.56"

  Scenario Outline: Refresh the dashboard balance after a money operation
    Given I am on the dashboard and my checking balance is $100.00
    When I complete a <money operation> that changes my checking balance
    Then the dashboard shows the resulting checking balance

    Examples:
      | money operation |
      | deposit          |
      | withdrawal       |
      | loan draw        |
      | loan payment     |
      | wire sent        |
      | wire received    |
