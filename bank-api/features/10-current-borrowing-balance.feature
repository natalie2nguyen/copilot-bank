Feature: Get current borrowing balance
  As a customer
  I want to see how much I owe and how much credit I have left
  So that I can manage my debt

  Background:
    Given I am logged in as a customer

  Scenario: Return loan balance, credit limit, and available credit
    Given my loan balance is $1,250.00
    When I request my current borrowing balance
    Then the response contains a loan balance of 125000 cents and "$1,250.00"
    And the response contains a credit limit of 500000 cents and "$5,000.00"
    And the response contains available credit of 375000 cents and "$3,750.00"

  Scenario: Show borrowing balances on the dashboard
    Given I am on the dashboard
    And my loan balance is $1,250.00
    And my available credit is $3,750.00
    Then the dashboard shows my loan balance next to my checking balance
    And the dashboard shows my available credit next to my checking balance
