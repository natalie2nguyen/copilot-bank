Feature: View transaction history
  As a customer
  I want to see my transaction history
  So that I can track where my money went

  Background:
    Given I am logged in as a customer

  Scenario: View my transactions newest first
    Given I have multiple transactions with different timestamps
    When I view my transaction history
    Then I see only my transactions
    And transactions are ordered newest first

  Scenario: Show the required details for each transaction
    Given I have a transaction with a type, amount, direction, timestamp, memo, and resulting balance
    When I view my transaction history
    Then the transaction shows its type
    And the transaction shows its amount
    And the transaction shows its signed direction
    And the transaction shows its timestamp
    And the transaction shows its memo
    And the transaction shows its resulting balance

  Scenario: Use the default page size
    Given I have more than 20 transactions
    When I view the first page of my transaction history without pagination options
    Then I see the 20 newest transactions

  Scenario: View a specified page of transactions
    Given I have multiple pages of transactions
    When I view page 2 with a page size of 5
    Then I see the transactions for page 2
    And I see no more than 5 transactions

  Scenario: Reject a page size above the supported maximum
    When I request transaction history with a page size above 100
    Then my request is rejected with status 400
    And I see a validation error

  Scenario: Filter transaction history by type
    Given I have "DEPOSIT" and "WITHDRAWAL" transactions
    When I filter my transaction history by "DEPOSIT"
    Then I see only "DEPOSIT" transactions

  Scenario: Show transaction history in the transaction table
    Given I am on the transaction history page
    Then I see a transaction table
    And I can filter transactions by type
    And I can navigate between pages
    And credits and debits are visually distinct
    And transaction amounts are formatted as currency
