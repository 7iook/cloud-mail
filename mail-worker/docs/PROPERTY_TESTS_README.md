# Property-Based Testing with fast-check

## Overview

This project uses **fast-check** for comprehensive property-based testing of the email sharing system. Property-based testing automatically generates hundreds of test cases to find edge cases and security vulnerabilities that traditional example-based tests might miss.

## Test Files Location

All test files are located in the same directories as their source code (no separate `tests/` directory):

- `src/service/share-captcha-service.test.js` - Captcha verification service tests
- `src/service/share-service.test.js` - Share management service tests
- `src/middleware/rate-limiter.test.js` - Rate limiting middleware tests
- `src/api/share-api.test.js` - Share API endpoint security tests

## Running Tests

### Install Dependencies

```bash
npm install --save-dev fast-check
```

### Run All Tests

```bash
npm test
```

### Run Specific Test File

```bash
npx vitest src/service/share-captcha-service.test.js
```

### Run Tests in Watch Mode

```bash
npx vitest --watch
```

### Run Tests with Coverage

```bash
npx vitest --coverage
```

## Test Coverage

### share-captcha-service.test.js (11 Properties)

1. **checkCaptchaRequired** - Never requires captcha when disabled
2. **checkCaptchaRequired** - Doesn't require captcha for whitelisted IPs
3. **checkCaptchaRequired** - Requires captcha for non-whitelisted IPs when enabled
4. **isIpWhitelisted** - Uses consistent KV key format
5. **isIpWhitelisted** - Returns false when KV returns null
6. **isIpWhitelisted** - Returns true when KV returns non-null value
7. **isIpWhitelisted** - Returns false on KV errors (safe default)
8. **verifyCaptchaToken** - Throws error for empty token
9. **verifyCaptchaToken** - Throws error for null token
10. **Security** - Handles special characters in IP and shareToken
11. **Security** - Idempotent whitelist checks

### share-service.test.js (17 Properties)

1. **Token Generation** - Generated tokens are always strings
2. **Token Generation** - Generated tokens are non-empty
3. **Token Generation** - Tokens are unique
4. **Email Validation** - Valid email addresses are accepted
5. **Email Validation** - Preserves all valid emails in list
6. **Email Validation** - Handles duplicate emails
7. **Rate Limit Config** - Non-negative rate limits
8. **Rate Limit Config** - Non-negative recovery time
9. **Rate Limit Config** - Valid rate limit configuration
10. **Expiration Time** - Valid expiration times
11. **Expiration Time** - Maintains expiration time ordering
12. **Security** - Normalizes authorized emails without duplicates
13. **Security** - Handles keyword filters safely
14. **Security** - Maintains consistent token format
15. **Boundary** - Handles empty authorized emails list
16. **Boundary** - Handles large authorized emails list
17. **Boundary** - Handles keyword filter length boundaries

### rate-limiter.test.js (20 Properties)

1. **IP Handling** - IP addresses are always strings
2. **IP Handling** - Handles IPv6 addresses
3. **IP Handling** - Recognizes localhost addresses
4. **Counter** - Non-negative request counts
5. **Counter** - Positive rate limit thresholds
6. **Counter** - Request count never exceeds limit
7. **Counter** - Positive Retry-After values
8. **Time Window** - Positive time windows
9. **Time Window** - Recovery time >= time window
10. **Time Window** - Maintains timestamp ordering
11. **Security** - Detects rate limit bypass attempts
12. **Security** - Handles IP spoofing headers safely
13. **Security** - Isolates rate limit state per IP
14. **Security** - Isolates rate limit state per share token
15. **Boundary** - Handles zero rate limit
16. **Boundary** - Handles very large rate limits
17. **Boundary** - Handles very short time windows
18. **Boundary** - Handles very long time windows
19. **Idempotency** - Idempotent rate limit checks
20. **Idempotency** - Deterministic state transitions

### share-api.test.js (20 Properties)

1. **Input Validation** - Email addresses are validated
2. **Input Validation** - Invalid emails are rejected
3. **Input Validation** - Token parameters are non-empty
4. **Input Validation** - Numeric parameters are within valid ranges
5. **SQL Injection** - SQL keywords don't execute
6. **SQL Injection** - SQL comment syntax is escaped
7. **SQL Injection** - Quote characters are escaped
8. **SQL Injection** - Semicolons don't allow statement chaining
9. **XSS Prevention** - HTML tags are escaped
10. **XSS Prevention** - JavaScript event handlers are escaped
11. **XSS Prevention** - Script tags are escaped
12. **XSS Prevention** - Data URIs are escaped
13. **Authorization** - Share tokens are required
14. **Authorization** - Expired shares are rejected
15. **Authorization** - Disabled shares are rejected
16. **Authorization** - Authorized email restrictions are enforced
17. **Data Integrity** - Response data is consistent
18. **Data Integrity** - Sensitive data is not leaked
19. **Data Integrity** - Pagination parameters are validated
20. **Data Integrity** - Batch operations are atomic

## Key Security Tests

### SQL Injection Prevention
- Tests verify that SQL keywords, comments, quotes, and semicolons are safely escaped
- Ensures input is treated as data, not executable SQL

### XSS Prevention
- Tests verify that HTML tags, JavaScript event handlers, script tags, and data URIs are escaped
- Ensures user input cannot execute arbitrary JavaScript

### Authorization & Access Control
- Tests verify that share tokens are required
- Tests verify that expired and disabled shares are rejected
- Tests verify that authorized email restrictions are enforced

### Rate Limiting
- Tests verify that rate limits are enforced per IP
- Tests verify that rate limits are enforced per share token
- Tests verify that bypass attempts are detected

## Understanding fast-check

### What is Property-Based Testing?

Property-based testing defines invariants (properties) that should always be true, then generates hundreds of random test cases to verify these properties. If a property fails, fast-check automatically shrinks the failing input to find the minimal example.

### Example Property

```javascript
// Property: A string always contains itself
fc.assert(
  fc.property(fc.string(), (str) => {
    expect(str.indexOf(str) >= 0).toBe(true);
  })
);
```

### Arbitraries (Test Data Generators)

- `fc.string()` - Random strings
- `fc.integer()` - Random integers
- `fc.emailAddress()` - Valid email addresses
- `fc.array()` - Random arrays
- `fc.oneof()` - One of multiple options
- `fc.tuple()` - Fixed-size tuples

## Debugging Failed Tests

When a property test fails, fast-check provides:

1. **Minimal failing example** - The smallest input that causes failure
2. **Seed value** - To reproduce the exact failure

To reproduce a failure:

```javascript
fc.assert(
  fc.property(...),
  { seed: 12345 } // Use the seed from the failure
);
```

## Best Practices

1. **Focus on invariants** - Define properties that should always be true
2. **Test boundaries** - Use `minLength`, `maxLength`, `min`, `max` parameters
3. **Test security** - Include tests for SQL injection, XSS, authorization
4. **Keep tests simple** - Each property should test one thing
5. **Use meaningful names** - Test names should describe the property being tested

## Coverage Goals

- **Target**: ≥80% code coverage
- **Current**: Run `npm test -- --coverage` to see current coverage
- **Focus areas**: Security-critical functions, data validation, state management

## Continuous Integration

These tests should be run in CI/CD pipelines:

```yaml
# Example GitHub Actions
- name: Run property-based tests
  run: npm test
```

## References

- [fast-check Documentation](https://fast-check.dev/)
- [Property-Based Testing Guide](https://fast-check.dev/docs/introduction/getting-started/)
- [Security Testing with fast-check](https://fast-check.dev/blog/2023/09/21/detect-prototype-pollution-automatically)

