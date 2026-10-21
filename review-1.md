# review-1

## Verdict: REJECT

## Critical (must fix before merge)

None identified.

## Major

1. **Avatar uploads trust the client-supplied MIME type.** [bank-api/src/app.ts:514](./bank-api/src/app.ts#L514) accepts an upload based on `request.file.mimetype` without verifying the file contents. A non-image file can claim `image/png` or `image/jpeg` and be stored and served as an image. The upload tests also use arbitrary buffers while labeling them as images, so they do not verify actual format handling. Validate the file signature or decode and re-encode the image; add tests for valid image data and mismatched or invalid content.

2. **Every authenticated request loads the customer's entire transaction history.** [bank-api/src/app.ts:190](./bank-api/src/app.ts#L190) queries all transactions while constructing a customer, and authenticated routes use that lookup. The history endpoint then paginates in memory at [bank-api/src/app.ts:798](./bank-api/src/app.ts#L798). As history grows, routine balance and profile requests become increasingly expensive, and a customer can cause large memory and response costs. Load transactions only when needed and apply filtering, pagination, and totals in database queries; cap the requested page size.

3. **Some API errors bypass the JSON error contract.** [bank-api/src/app.ts:8](./bank-api/src/app.ts#L8) installs JSON parsing, and upload errors are forwarded with `next(error)` at [bank-api/src/app.ts:501](./bank-api/src/app.ts#L501), but the app has no error-handling middleware. Malformed JSON, unexpected upload errors, or other thrown errors can fall through to Express's default error handler instead of returning `{ "error": { "code": "...", "message": "..." } }`. Add centralized error middleware and tests that assert the JSON response shape for these failures.

## Minor

None identified.

## Missing scenarios / tests

- The registration feature includes **“Store the registration password as a hash,”** but [bank-api/tests/register.test.ts](./bank-api/tests/register.test.ts) only checks that the password is absent from the response. Add a test that verifies the stored credential is a hash and is not the plain-text password.
- Add tests for avatar content that claims an image MIME type but is not actually PNG or JPEG.
