import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import * as bcrypt from 'bcryptjs';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

// Load .env.local first if available, then fallback to .env
const envLocal = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocal)) {
  dotenv.config({ path: envLocal });
}
dotenv.config();

function askQuestion(query: string, hidden = false): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    if (hidden) {
      // Mute terminal output for password entry
      process.stdout.write(query);
      const stdin = process.stdin;
      const oldRaw = stdin.isRaw;
      if (stdin.setRawMode) {
        stdin.setRawMode(true);
      }
      stdin.resume();

      let password = '';
      const onData = (chunk: Buffer) => {
        const char = chunk.toString();
        if (char === '\n' || char === '\r' || char === '\u0004') {
          stdin.removeListener('data', onData);
          if (stdin.setRawMode) {
            stdin.setRawMode(oldRaw ?? false);
          }
          process.stdout.write('\n');
          rl.close();
          resolve(password);
        } else if (char === '\u0008' || char === '\x7f') {
          // Backspace
          password = password.slice(0, -1);
        } else {
          password += char;
        }
      };

      stdin.on('data', onData);
    } else {
      rl.question(query, (answer) => {
        rl.close();
        resolve(answer);
      });
    }
  });
}

function parseCliArgs(): { email?: string; password?: string } {
  const args = process.argv.slice(2);
  const result: { email?: string; password?: string } = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--email' && args[i + 1]) {
      result.email = args[i + 1];
      i++;
    } else if (args[i] === '--password' && args[i + 1]) {
      result.password = args[i + 1];
      i++;
    }
  }

  return result;
}

async function main() {
  console.log('=== Beauty Salon Administrator Provisioning ===\n');

  const cliArgs = parseCliArgs();

  let email = cliArgs.email || process.env.ADMIN_EMAIL;
  let password = cliArgs.password || process.env.ADMIN_PASSWORD;

  if (!email) {
    email = await askQuestion('Enter administrator email: ');
  }

  email = email.trim().toLowerCase();
  if (!email || !email.includes('@')) {
    console.error('Error: A valid email address is required.');
    process.exit(1);
  }

  if (!password) {
    password = await askQuestion('Enter administrator password (hidden): ', true);
  }

  if (!password || password.length < 4) {
    console.error('Error: Password must be at least 4 characters long.');
    process.exit(1);
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('Error: DATABASE_URL is not set in environment or .env/.env.local.');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const existingAdmin = await prisma.admin.findUnique({
      where: { email },
    });

    if (existingAdmin) {
      await prisma.admin.update({
        where: { email },
        data: {
          passwordHash,
          updatedAt: new Date(),
        },
      });
      console.log(`\n✓ Administrator credentials updated successfully for: ${email}`);
    } else {
      await prisma.admin.create({
        data: {
          email,
          passwordHash,
        },
      });
      console.log(`\n✓ Administrator account created successfully for: ${email}`);
    }
  } catch (error) {
    console.error('\n✗ Error provisioning administrator account:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

void main();
