// Cloudflare D1 Database Fix Script
// This script adds missing rate limit fields to the share table

const ACCOUNT_ID = '8f1459129cd0d7e9ba091f6f6e35f9c2';
const DATABASE_ID = 'a4c1a63a-6ef5-4e6d-8e8c-b6d9e8feb810';

async function executeSQL(sql) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/query`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql }),
    }
  );
  
  const result = await response.json();
  console.log('SQL:', sql);
  console.log('Response:', JSON.stringify(result, null, 2));
  return result;
}

async function main() {
  console.log('Starting database fix...\n');
  
  // Step 1: Add rate_limit_per_second field
  console.log('Step 1: Adding rate_limit_per_second field...');
  await executeSQL('ALTER TABLE share ADD COLUMN rate_limit_per_second INTEGER DEFAULT 5 NOT NULL;');
  
  // Step 2: Add rate_limit_per_minute field
  console.log('\nStep 2: Adding rate_limit_per_minute field...');
  await executeSQL('ALTER TABLE share ADD COLUMN rate_limit_per_minute INTEGER DEFAULT 60 NOT NULL;');
  
  // Step 3: Verify table structure
  console.log('\nStep 3: Verifying table structure...');
  await executeSQL('PRAGMA table_info(share);');
  
  console.log('\nDatabase fix completed!');
}

main().catch(console.error);
