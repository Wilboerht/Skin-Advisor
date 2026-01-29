const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const args = process.argv.slice(2);
const targetProvider = args[0] || 'sqlite'; // default to sqlite

const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');
const envPath = path.join(__dirname, '..', '.env');

// Define source env files
const envMap = {
  sqlite: '.env.sqlite',
  supabase: '.env.supabase',
  postgres: '.env.supabase' 
};

// Configurations for schema.prisma
const CONFIGS = {
  sqlite: `datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}`,
  postgres: `datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}`
};

// Validate provider
const providerKey = (targetProvider === 'supabase' || targetProvider === 'postgres') ? 'postgres' : 'sqlite';
const sourceEnvFile = envMap[targetProvider] || envMap.sqlite;
const sourceEnvPath = path.join(__dirname, '..', sourceEnvFile);

console.log(`🔄 Switching to mode: ${targetProvider.toUpperCase()}`);

try {
  // 1. Update schema.prisma
  console.log(`1️⃣  Updating schema.prisma provider to ${providerKey}...`);
  let schemaContent = fs.readFileSync(schemaPath, 'utf8');
  const datasourceRegex = /datasource\s+db\s+\{[\s\S]*?\}/;

  if (schemaContent.match(datasourceRegex)) {
    const newContent = schemaContent.replace(datasourceRegex, CONFIGS[providerKey]);
    fs.writeFileSync(schemaPath, newContent);
  } else {
    console.error("❌ Could not find 'datasource db' block in schema.prisma");
    process.exit(1);
  }

  // 2. Update .env file
  console.log(`2️⃣  Copying ${sourceEnvFile} to .env...`);
  if (fs.existsSync(sourceEnvPath)) {
    fs.copyFileSync(sourceEnvPath, envPath);
  } else {
    console.warn(`⚠️  Source env file ${sourceEnvFile} not found! Skipping .env update.`);
  }

  // 3. Generate Prisma Client
  console.log("3️⃣  Running prisma generate...");
  execSync('npx prisma generate', { stdio: 'inherit' });
  
  console.log(`✅ Successfully switched to ${targetProvider}!`);

} catch (error) {
  console.error("❌ An error occurred:", error);
  process.exit(1);
}
