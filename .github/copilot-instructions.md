This project uses TypeScript: Express for the API and React + Vite for the web app.
The tech stack and framework used in the project:
- API: Express
- Validation: zod
- Password hashing: bcryptjs
- File upload: multer with in-memory storage
- Front end: React + Vite
- Tests: Vitest (+ supertest for API routes)
- Gherkin runner: @amiceli/vitest-cucumber

Money is represented as integer cents in calculations and API data, and formatted as currency only for display.
- For example, $10.50 should be represented as 1050

Error response format should be represented as a JSON object with the following structure: 
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Error message"
  }
}
- For example, if a withdrawal fails due to insufficient funds, the error response should be:

{ "error": { "code": "INSUFFICIENT_FUNDS", "message": "Balance is too low for this withdrawal." } }

Naming conventions and folder structure
- This project is composed of two folders: bank-api and bank-web. 
- bank-api is the REST API backend: accounts, profiles, transactions, loans, wires
- bank-web is the front end that calls the API
- Use camelCase for variable and function names.
- Use PascalCase for class and interface names.


Behavior is specified in features/*.feature. Never implement behavior that has no scenario. Never edit a test to make it pass.