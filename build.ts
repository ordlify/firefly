import { execSync } from "child_process";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

interface ProcessEnv {
  [key: string]: string | undefined;
}

// Validate required environment variables
const requiredEnvVars = [
  "AUTH_TOKEN",
  "FALLBACK_404",
  "ZONE_NAME",
  "R2_BUCKET_NAME",
] as const;
type RequiredEnvVar = (typeof requiredEnvVars)[number];

const missingEnvVars = requiredEnvVars.filter(
  (envVar) => !process.env[envVar as keyof ProcessEnv]
);

if (missingEnvVars.length > 0) {
  console.error(
    "Missing required environment variables:",
    missingEnvVars.join(", ")
  );
  process.exit(1);
}

// Ensure build directory exists
const buildDir = path.join(process.cwd(), "dist");
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

// Generate wrangler.toml
function generateWranglerConfig() {
  console.log("📝 Generating wrangler.toml...");
  let config = fs.readFileSync("wrangler.toml.template", "utf8");

  // Replace environment variables
  config = config
    .replace(/\$R2_BUCKET_NAME/g, process.env.R2_BUCKET_NAME || "")
    .replace(/\$ZONE_NAME/g, process.env.ZONE_NAME || "")
    .replace(/\$FALLBACK_404/g, process.env.FALLBACK_404 || "")
    .replace(/\$AUTH_TOKEN/g, process.env.AUTH_TOKEN || "");

  const wranglerPath = path.join(process.cwd(), "wrangler.toml");
  fs.writeFileSync(wranglerPath, config);
  console.log("✓ wrangler.toml generated");
}

// Generate environment file
function generateEnvFile() {
  console.log("📝 Generating environment file...");
  const envContent = `
# Generated environment variables - DO NOT EDIT
AUTH_TOKEN=${process.env.AUTH_TOKEN}
FALLBACK_404=${process.env.FALLBACK_404}
`.trim();

  const envPath = path.join(buildDir, ".env.production");
  fs.writeFileSync(envPath, envContent);
  console.log("✓ Environment file generated");
}

try {
  console.log("🏗️  Starting build process...");

  // Generate configuration files
  generateWranglerConfig();
  generateEnvFile();

  // Check if bucket exists by listing buckets
  console.log("🪣 Checking R2 bucket...");
  const bucketList = execSync("wrangler r2 bucket list", { encoding: "utf8" });
  const bucketName = process.env.R2_BUCKET_NAME;

  if (!bucketList.includes(bucketName!)) {
    console.log(`Creating bucket '${bucketName}'...`);
    execSync(`wrangler r2 bucket create ${bucketName}`, { stdio: "inherit" });
  } else {
    console.log(`Bucket '${bucketName}' already exists ✓`);
  }

  // Copy source files to build directory
  console.log("📦 Copying source files...");
  fs.cpSync("src", path.join(buildDir, "src"), { recursive: true });

  console.log("✅ Build complete! Run 'pnpm run deploy' to deploy");
} catch (error) {
  console.error("❌ Build failed:", error);
  process.exit(1);
}
