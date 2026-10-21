Feature: Manage account profile
  As a customer
  I want to view and update my profile
  So that my bank has my correct contact information

  Background:
    Given I am logged in as a customer

  Scenario: View my profile
    When I view my profile
    Then I see my current name, email, and address

  Scenario: Update my name
    When I update my name to "Taylor Example"
    Then my profile shows the name "Taylor Example"

  Scenario: Reject a blank name
    When I update my name to a blank value
    Then my profile update is rejected
    And my name remains unchanged

  Scenario: Update my address
    When I update my address with a street, city, state or region, postal code, and country
    Then my profile shows the updated address

  Scenario: Save an address without a postal code
    When I update my address without a postal code
    Then my profile shows the updated address with no postal code

  Scenario: Update only some address fields
    When I update only the city and country in my address
    Then my profile shows the updated city and country
    And the other address fields remain unchanged

  Scenario: Reject a blank postal code when one is provided
    When I update my address with a blank postal code
    Then my profile update is rejected
    And my address remains unchanged

  Scenario: Update my email
    When I update my email to a valid unused email address
    Then my profile shows the updated email address

  Scenario: Reject an invalid email update
    When I update my email to an invalid email address
    Then my profile update is rejected
    And my email remains unchanged

  Scenario: Reject an email already used by another customer
    Given another customer has email "other@example.com"
    When I update my email to "other@example.com"
    Then my profile update is rejected with status 409
    And my email remains unchanged

  Scenario: Update only the fields provided
    Given my profile has a name, email, and address
    When I update only my name
    Then my name is updated
    And my email and address remain unchanged

  Scenario Outline: Upload a supported profile picture within the size limit
    When I upload a <image type> profile picture of <file size>
    Then my profile picture is accepted
    And the uploaded picture is available on my profile page
    And the picture is served back to the front end

    Examples:
      | image type | file size |
      | PNG        | 1 MB      |
      | PNG        | 2 MB      |
      | JPEG       | 1 MB      |
      | JPEG       | 2 MB      |

  Scenario: Reject an unsupported profile picture format
    When I upload a profile picture that is not PNG or JPEG
    Then the upload is rejected with status 415

  Scenario: Reject a profile picture larger than 2 MB
    When I upload a PNG or JPEG profile picture larger than 2 MB
    Then the upload is rejected with status 413

  Scenario: Remove my profile picture
    Given I have a profile picture
    When I remove my profile picture
    Then my profile picture is absent
    And my profile page shows my initials or a placeholder avatar

  Scenario: View my profile page and edit form
    Given I am on my profile page
    Then I see my current profile values and an edit form
    And I can upload or remove my profile picture

  Scenario: Prevent viewing another customer's profile
    Given another customer has a profile
    When I try to view that customer's profile
    Then access is denied

  Scenario: Prevent updating another customer's profile
    Given another customer has a profile
    When I try to update that customer's profile
    Then access is denied
    And the other customer's profile remains unchanged
