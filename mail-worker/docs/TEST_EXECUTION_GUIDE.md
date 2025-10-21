# Property-Based Testing Execution Guide

## Quick Start

### 1. Install Dependencies

```bash
cd mail-worker
npm install --save-dev fast-check
```

### 2. Run All Property-Based Tests

```bash
npx vitest --config vitest.config.property.js
```

### 3. Run Specific Test Suite

```bash
# Test captcha service
npx vitest src/service/share-captcha-service.test.js

# Test share service
npx vitest src/service/share-service.test.js

# Test rate limiter
npx vitest src/middleware/rate-limiter.test.js

# Test share API
npx vitest src/api/share-api.test.js
```

## Test Execution Modes

### Watch Mode (Development)

```bash
npx vitest --watch --config vitest.config.property.js
```

Automatically re-runs tests when files change.

### Coverage Report

```bash
npx vitest --coverage --config vitest.config.property.js
```

Generates coverage reports in:
- `coverage/index.html` - HTML report
- `coverage/coverage-final.json` - JSON report

### Single Run (CI/CD)

```bash
npx vitest run --config vitest.config.property.js
```

Runs tests once and exits.

## Test Organization

### Test File Structure

Each test file follows this pattern:

```javascript
import fc from 'fast-check';
import { describe, it, expect } from 'vitest';

describe('Feature - Property-Based Tests', () => {
  describe('Category', () => {
    it('should have property X', () => {
      fc.assert(
        fc.property(
          fc.string(),
          (input) => {
            // Property assertion
            expect(result).toBe(expected);
          }
        )
      );
    });
  });
});
```

### Test Categories

1. **Functional Properties** - Core functionality invariants
2. **Security Properties** - SQL injection, XSS, authorization
3. **Boundary Conditions** - Edge cases and limits
4. **Idempotency** - Consistency across multiple calls
5. **Data Integrity** - Consistency and correctness

## Understanding Test Output

### Successful Test

```
✓ src/service/share-captcha-service.test.js (11)
  ✓ shareCaptchaService - Property-Based Tests (11)
    ✓ checkCaptchaRequired
      ✓ should never require captcha when disabled
      ✓ should not require captcha for whitelisted IPs
      ✓ should require captcha for non-whitelisted IPs when enabled
```

### Failed Test with Seed

```
✗ should validate email format
  Error: Property failed after 42 tests
  Seed: 1234567890
  Counterexample: ["invalid@email"]
```

To reproduce:
```javascript
fc.assert(property, { seed: 1234567890 });
```

## Performance Considerations

### Default Settings

- **Number of runs**: 100 per property
- **Timeout**: 30 seconds per test
- **Threads**: 4 parallel threads

### Adjust for CI/CD

```bash
# Increase runs for thorough testing
npx vitest --config vitest.config.property.js -- --numRuns=1000

# Reduce runs for faster feedback
npx vitest --config vitest.config.property.js -- --numRuns=10
```

## Debugging Failed Tests

### 1. Get the Seed Value

When a test fails, fast-check outputs the seed:
```
Seed: 1234567890
```

### 2. Reproduce the Failure

```javascript
fc.assert(
  fc.property(fc.string(), (str) => {
    // Your test
  }),
  { seed: 1234567890 }
);
```

### 3. Add Logging

```javascript
fc.assert(
  fc.property(fc.string(), (str) => {
    console.log('Testing with:', str);
    // Your test
  })
);
```

### 4. Shrink to Minimal Example

fast-check automatically shrinks to the minimal failing input.

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: Property-Based Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run test:properties
```

### Add to package.json

```json
{
  "scripts": {
    "test:properties": "vitest run --config vitest.config.property.js",
    "test:properties:watch": "vitest --config vitest.config.property.js",
    "test:properties:coverage": "vitest --coverage --config vitest.config.property.js"
  }
}
```

## Test Statistics

### Total Properties: 68

- **share-captcha-service.test.js**: 11 properties
- **share-service.test.js**: 17 properties
- **rate-limiter.test.js**: 20 properties
- **share-api.test.js**: 20 properties

### Coverage by Category

- **Security**: 24 properties (35%)
- **Functional**: 28 properties (41%)
- **Boundary**: 12 properties (18%)
- **Idempotency**: 4 properties (6%)

## Troubleshooting

### Tests Timeout

Increase timeout in `vitest.config.property.js`:
```javascript
testTimeout: 60000 // 60 seconds
```

### Out of Memory

Reduce parallel threads:
```javascript
maxThreads: 2
```

### Import Errors

Ensure all dependencies are installed:
```bash
npm install
```

## Best Practices

1. **Run tests before committing**
   ```bash
   npm run test:properties
   ```

2. **Check coverage regularly**
   ```bash
   npm run test:properties:coverage
   ```

3. **Review failed seeds**
   - Save seed values for regression testing
   - Add specific tests for discovered edge cases

4. **Keep tests fast**
   - Use appropriate data generators
   - Avoid expensive operations in properties

## References

- [fast-check Documentation](https://fast-check.dev/)
- [Vitest Documentation](https://vitest.dev/)
- [Property-Based Testing Guide](https://fast-check.dev/docs/introduction/getting-started/)

