// scripts/hash-admin-password.mjs
// Prints a scrypt hash to paste into ADMIN_PASSWORD_HASH in .env.local.
// Run with: node scripts/hash-admin-password.mjs "yourpassword"
import { randomBytes, scryptSync } from "node:crypto";

const password = process.argv[2];
if (!password) {
  console.error("Usage: node scripts/hash-admin-password.mjs <password>");
  process.exit(1);
}

const salt = randomBytes(16);
const hash = scryptSync(password, salt, 64);
console.log(`${salt.toString("hex")}:${hash.toString("hex")}`);
