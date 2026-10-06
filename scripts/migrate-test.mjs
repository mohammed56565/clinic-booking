import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import dotenv from "dotenv";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: resolve(root, "apps/api/.env"), quiet: true });
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test"))
  throw new Error(
    "TEST_DATABASE_URL must point to a dedicated database ending with _test.",
  );
const result = spawnSync(
  process.execPath,
  [resolve(root, "node_modules/prisma/build/index.js"), "migrate", "deploy"],
  {
    cwd: resolve(root, "apps/api"),
    env: { ...process.env, DATABASE_URL: url },
    stdio: "inherit",
  },
);
process.exit(result.status ?? 1);
