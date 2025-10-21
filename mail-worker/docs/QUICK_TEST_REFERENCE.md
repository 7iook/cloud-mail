# Quick Test Reference Card

## One-Liner Commands

```bash
# Run all property-based tests
npm run test:properties

# Watch mode (auto-rerun on changes)
npm run test:properties:watch

# Generate coverage report
npm run test:properties:coverage

# Run specific test file
npx vitest src/service/share-captcha-service.test.js

# Run with specific seed (reproduce failure)
npx vitest -- --seed=1234567890
```

## Test Files Location

```
src/
├── api/share-api.test.js (20 properties)
├── middleware/rate-limiter.test.js (20 properties)
└── service/
    ├── share-captcha-service.test.js (11 properties)
    └── share-service.test.js (17 properties)
```

## What Gets Tested

### Security (24 properties)
- ✅ SQL Injection prevention
- ✅ XSS prevention
- ✅ Authorization bypass
- ✅ Rate limit bypass
- ✅ IP spoofing
- ✅ Data leakage

### Functionality (28 properties)
- ✅ Token generation
- ✅ Email validation
- ✅ Rate limiting
- ✅ Captcha verification
- ✅ Expiration logic
- ✅ State management

### Boundaries (12 properties)
- ✅ Empty inputs
- ✅ Large inputs
- ✅ Edge cases
- ✅ Limits

### Idempotency (4 properties)
- ✅ Consistent results
- ✅ Deterministic behavior

## Understanding Output

### ✅ Success
```
✓ src/service/share-captcha-service.test.js (11)
  ✓ shareCaptchaService - Property-Based Tests (11)
    ✓ checkCaptchaRequired
      ✓ should never require captcha when disabled
```

### ❌ Failure
```
✗ should validate email format
  Error: Property failed after 42 tests
  Seed: 1234567890
  Counterexample: ["invalid@email"]
```

**To reproduce**: Add `{ seed: 1234567890 }` to the test

## Common Issues & Solutions

### Tests Timeout
```javascript
// In vitest.config.property.js
testTimeout: 60000 // Increase to 60 seconds
```

### Out of Memory
```javascript
// In vitest.config.property.js
maxThreads: 2 // Reduce parallel threads
```

### Import Errors
```bash
npm install
```

### Need More Runs
```bash
npx vitest -- --numRuns=1000
```

## Test Statistics

| File | Properties | Focus |
|------|-----------|-------|
| share-captcha-service.test.js | 11 | Captcha verification |
| share-service.test.js | 17 | Share management |
| rate-limiter.test.js | 20 | Rate limiting |
| share-api.test.js | 20 | API security |
| **TOTAL** | **68** | **Email sharing system** |

## Key Concepts

### Property
An invariant that should always be true:
```javascript
// Property: Tokens are never empty
fc.property(fc.string(), (token) => {
  expect(token.length).toBeGreaterThan(0);
})
```

### Arbitrary
A generator for random test data:
```javascript
fc.string()           // Random strings
fc.emailAddress()     // Valid emails
fc.integer()          // Random integers
fc.array()            // Random arrays
```

### Seed
Reproduces exact test failure:
```javascript
fc.assert(property, { seed: 1234567890 })
```

## Coverage Goals

- **Target**: ≥80%
- **Check**: `npm run test:properties:coverage`
- **Report**: `coverage/index.html`

## CI/CD Integration

### GitHub Actions
```yaml
- name: Run property tests
  run: npm run test:properties
```

### GitLab CI
```yaml
test:properties:
  script:
    - npm run test:properties
```

## Debugging Tips

1. **Get the seed from failure output**
2. **Reproduce with seed**: `fc.assert(property, { seed: 123 })`
3. **Add console.log** to see what's being tested
4. **Check minimal example** - fast-check shrinks to smallest failure

## Performance

- **Runs per property**: 100 (default)
- **Timeout**: 30 seconds per test
- **Parallel threads**: 4
- **Total time**: ~30 seconds for full suite

## File Organization

✅ **Correct** - Test files in same directory as source:
```
src/service/share-service.js
src/service/share-service.test.js
```

❌ **Wrong** - Separate tests directory:
```
src/service/share-service.js
tests/service/share-service.test.js
```

## Next Steps

1. Run tests: `npm run test:properties`
2. Check coverage: `npm run test:properties:coverage`
3. Fix any failures (use seed values)
4. Integrate into CI/CD
5. Monitor for regressions

## Resources

- [fast-check Docs](https://fast-check.dev/)
- [Vitest Docs](https://vitest.dev/)
- [Property Testing Guide](https://fast-check.dev/docs/introduction/getting-started/)

---

**Total Properties**: 68 | **Security Focus**: 35% | **Coverage Target**: 80%

