/**
 * Preset Email Templates for Common Verification Code Patterns
 * These templates are system-provided and read-only
 * Users can copy these templates to create their own customized versions
 */

export const PRESET_TEMPLATES = [
  {
    id: 'preset-augment-code',
    name: 'Augment Code Verification',
    description: 'Augment Code verification codes (6-digit numeric)',
    senderPattern: 'auggie@augmentcode\\.com',
    subjectPattern: 'Welcome to Augment Code',
    bodyPattern: 'Your verification code is:',
    extractionRegex: 'Your verification code is:\\s*(\\d{6})',
    codeFormat: '6-digit numeric',
    exampleEmail: `Your verification code is: 753942

If you are having any issues with your account, please don't hesitate to contact us by replying to this mail.

Thanks!
Augment Code

If you did not make this request, you can safely ignore this email. Never share this one-time code with anyone - Augment support will never ask for your verification code. Your account remains secure and no action is needed.`,
    exampleCode: '753942',
    isActive: 1,
    userId: 1,
  },
  {
    id: 'preset-github',
    name: 'GitHub Verification Code',
    description: 'GitHub email verification codes (6-digit numeric)',
    senderPattern: 'noreply@github\\.com',
    subjectPattern: 'verification|confirm|authenticate',
    bodyPattern: '',
    extractionRegex: '\\b\\d{6}\\b',
    codeFormat: '6-digit numeric',
    exampleEmail: `From: noreply@github.com
Subject: [GitHub] Please verify your email address

Hi there,

Please verify your email address by entering this code:

123456

This code will expire in 10 minutes.

Thanks,
The GitHub Team`,
    exampleCode: '123456',
    isActive: 1,
    userId: 1,
  },
  {
    id: 'preset-google',
    name: 'Google/Gmail Verification Code',
    description: 'Google and Gmail verification codes (6-digit numeric)',
    senderPattern: '@google\\.com|@gmail\\.com',
    subjectPattern: 'verification code|verify|security code',
    bodyPattern: '',
    extractionRegex: '\\b\\d{6}\\b',
    codeFormat: '6-digit numeric',
    exampleEmail: `From: no-reply@accounts.google.com
Subject: Google Verification Code

Your Google verification code is:

987654

If you didn't request this code, you can safely ignore this email.

Google`,
    exampleCode: '987654',
    isActive: 1,
    userId: 1,
  },
  {
    id: 'preset-aws',
    name: 'AWS Verification Code',
    description: 'Amazon Web Services verification codes (6-digit numeric)',
    senderPattern: '@amazon\\.com|@aws\\.amazon\\.com',
    subjectPattern: 'verification|one-time|security code',
    bodyPattern: '',
    extractionRegex: '\\b\\d{6}\\b',
    codeFormat: '6-digit numeric',
    exampleEmail: `From: no-reply@aws.amazon.com
Subject: AWS Verification Code

Your AWS verification code is: 456789

This code expires in 15 minutes.

Amazon Web Services`,
    exampleCode: '456789',
    isActive: 1,
    userId: 1,
  },
  {
    id: 'preset-generic-6digit',
    name: 'Generic 6-Digit Verification Code',
    description: 'Universal template for 6-digit numeric verification codes',
    senderPattern: '',
    subjectPattern: 'verification|code|OTP|one-time|authenticate',
    bodyPattern: '',
    extractionRegex: '\\b\\d{6}\\b',
    codeFormat: '6-digit numeric',
    exampleEmail: `Subject: Your Verification Code

Your verification code is: 112233

Please enter this code to complete your verification.

This code will expire in 10 minutes.`,
    exampleCode: '112233',
    isActive: 1,
    userId: 1,
  },
  {
    id: 'preset-context-aware',
    name: 'Context-Aware Verification Code',
    description: 'Smart template that extracts codes with context keywords',
    senderPattern: '',
    subjectPattern: 'verification|code|OTP|security',
    bodyPattern: 'verification code|security code|OTP',
    extractionRegex: '(?:verification code|security code|OTP)(?:\\s*is)?[:\\s]+(\\d{4,8})',
    codeFormat: '4-8 digit numeric',
    exampleEmail: `Your security code is: 998877

Use this code to verify your identity.

This code expires in 15 minutes.`,
    exampleCode: '998877',
    isActive: 1,
    userId: 1,
  },
  {
    id: 'preset-generic-4digit',
    name: 'Generic 4-Digit Verification Code',
    description: 'Universal template for 4-digit numeric verification codes',
    senderPattern: '',
    subjectPattern: 'verification|code|OTP|one-time|PIN',
    bodyPattern: '',
    extractionRegex: '\\b\\d{4}\\b',
    codeFormat: '4-digit numeric',
    exampleEmail: `Subject: Your Security Code

Your security code is: 5678

Enter this code to verify your identity.

Code expires in 5 minutes.`,
    exampleCode: '5678',
    isActive: 1,
    userId: 1,
  },
  {
    id: 'preset-alphanumeric',
    name: 'Alphanumeric 6-Character Code',
    description: 'Template for 6-character alphanumeric verification codes',
    senderPattern: '',
    subjectPattern: 'verification|code|confirm',
    bodyPattern: '',
    extractionRegex: '\\b[A-Z0-9]{6}\\b',
    codeFormat: '6-character alphanumeric',
    exampleEmail: `Subject: Verification Code

Your verification code is: AB12CD

Please use this code to complete your registration.

This code is valid for 15 minutes.`,
    exampleCode: 'AB12CD',
    isActive: 1,
    userId: 1,
  },
  {
    id: 'preset-microsoft',
    name: 'Microsoft/Outlook Verification Code',
    description: 'Microsoft and Outlook verification codes (6-digit numeric)',
    senderPattern: '@microsoft\\.com|@outlook\\.com|@live\\.com',
    subjectPattern: 'security code|verification|Microsoft account',
    bodyPattern: '',
    extractionRegex: '\\b\\d{6}\\b',
    codeFormat: '6-digit numeric',
    exampleEmail: `From: account-security-noreply@microsoft.com
Subject: Microsoft account security code

Your security code is: 334455

Use this code to verify your Microsoft account.

Microsoft account team`,
    exampleCode: '334455',
    isActive: 1,
    userId: 1,
  },
  {
    id: 'preset-stripe',
    name: 'Stripe Payment Verification',
    description: 'Stripe payment and account verification codes (6-digit numeric)',
    senderPattern: '@stripe\\.com',
    subjectPattern: 'verification|confirm|security code',
    bodyPattern: '',
    extractionRegex: '\\b\\d{6}\\b',
    codeFormat: '6-digit numeric',
    exampleEmail: `From: no-reply@stripe.com
Subject: Stripe verification code

Your Stripe verification code is: 778899

Enter this code to confirm your payment method.

Stripe`,
    exampleCode: '778899',
    isActive: 1,
    userId: 1,
  },
];

/**
 * Get all preset templates
 * @returns {Array} Array of preset template objects
 */
export function getPresetTemplates() {
  return PRESET_TEMPLATES.map(template => ({
    ...template,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));
}

/**
 * Get a specific preset template by ID
 * @param {string} presetId - Preset template ID
 * @returns {Object|null} Preset template object or null if not found
 */
export function getPresetTemplateById(presetId) {
  const template = PRESET_TEMPLATES.find(t => t.id === presetId);
  if (!template) return null;
  
  return {
    ...template,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

