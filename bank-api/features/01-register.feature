Feature: Register and create an account
  As a new customer
  I want to create an account with my name, email, and password
  So that I can start banking online

  Scenario: Register successfully without an address
    When I register with my name, a valid email, and a password of at least 8 characters
    And I leave the address blank
    Then my registration succeeds with status 201
    And my profile contains my name and email
    And my account number contains exactly 10 digits
    And my account balance is $0.00
    And my plain-text password is not included in the response

  Scenario: Store the registration password as a hash
    When I register with a valid name, email, and password
    Then my password is stored as a hash and not as plain text

  Scenario Outline: Registration requires name, email, and password
    When I register without a <required field>
    Then my registration is rejected
    And I see a validation error for the missing field

    Examples:
      | required field |
      | name           |
      | email          |
      | password       |

  Scenario: Reject an invalid email during registration
    When I register with an invalid email format
    Then my registration is rejected
    And I see an email validation error

  Scenario: Reject a duplicate email regardless of letter case
    Given an account already exists with email "Taylor@example.com"
    When I register with email "taylor@EXAMPLE.com"
    Then my registration is rejected with status 409

  Scenario: Reject a password shorter than 8 characters
    When I register with a password shorter than 8 characters
    Then my registration is rejected
    And I see a password length validation error

  Scenario: Log in successfully
    Given I have a registered account
    When I log in with its email and correct password
    Then I receive an authentication token

  Scenario Outline: Reject login with incorrect credentials generically
    Given I have a registered account
    When I log in with an incorrect <credential>
    Then my login is rejected with status 401
    And I see a generic message that does not identify the incorrect credential

    Examples:
      | credential |
      | email      |
      | password   |

  Scenario: Show client-side validation errors on the registration page
    Given I am on the registration page
    When I submit the form with a missing required field or invalid input
    Then the invalid field has a visible validation error
    And the invalid form is not submitted

  Scenario: Show client-side validation errors on the login page
    Given I am on the login page
    When I submit the form with a missing or invalid value
    Then I see a visible validation error
    And the invalid form is not submitted
