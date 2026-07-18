#!/usr/bin/env node
// Pulls environment variables from Vercel API and writes them to .env.local
// Usage:
//   1. Create a Vercel token: https://vercel.com/account/tokens
//   2. Set it in your shell: $env:VERCEL_TOKEN="your_token" (PowerShell)
//   3. Run: node scripts/pull-vercel-env.mjs [production|preview|development]

import fs from "fs";
import path from "path";

const token = process.env.VERCEL_TOKEN;
if (!token) {
  console.error("Error: VERCEL_TOKEN environment variable is required.");
  console.error("Create one at: https://vercel.com/account/tokens");
  process.exit(1);
}

const targetEnv = process.argv[2] || "production";
const validTargets = new Set(["production", "preview", "development"]);
if (!validTargets.has(targetEnv)) {
  console.error(`Error: target must be one of ${[...validTargets].join(", ")}`);
  process.exit(1);
}

const projectFilePath = path.resolve(process.cwd(), ".vercel", "project.json");
if (!fs.existsSync(projectFilePath)) {
  console.error("Error: .vercel/project.json not found. Run `npx vercel link` first.");
  process.exit(1);
}

const project = JSON.parse(fs.readFileSync(projectFilePath, "utf8"));
const projectId = project.projectId || project.project_id;
if (!projectId) {
  console.error("Error: projectId not found in .vercel/project.json");
  process.exit(1);
}

let nextUrl = `https://api.vercel.com/v9/projects/${encodeURIComponent(projectId)}/env`;
const allEnvs = [];

console.log(`Fetching env vars from Vercel for target: ${targetEnv}...`);

while (nextUrl) {
  const res = await fetch(nextUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`Vercel API error (${res.status}):`, err);
    process.exit(1);
  }

  const data = await res.json();
  allEnvs.push(...(data.envs || []));
  nextUrl = data.pagination?.next ?? null;
}

// Filter by target environment and deduplicate by key
const seen = new Set();
const filtered = [];

for (const item of allEnvs) {
  const targets = Array.isArray(item.target) ? item.target : [item.target];
  if (!targets.includes(targetEnv)) continue;
  if (seen.has(item.key)) continue;
  seen.add(item.key);
  filtered.push(item);
}

if (filtered.length === 0) {
  console.log(`No env variables found for target: ${targetEnv}`);
  process.exit(0);
}

let output = `# Created from Vercel via API - target: ${targetEnv}\n`;
const missingValues = [];

for (const { key, value } of filtered) {
  if (value === null || value === undefined || value === "") {
    output += `${key}=""\n`;
    missingValues.push(key);
  } else {
    // Escape double quotes in the value
    const escaped = String(value).replace(/"/g, '\\"');
    output += `${key}="${escaped}"\n`;
  }
}

const outPath = path.resolve(process.cwd(), ".env.local");
fs.writeFileSync(outPath, output);

console.log(`\nWrote ${filtered.length} variables to ${outPath}`);
if (missingValues.length > 0) {
  console.log(`\nWarning: ${missingValues.length} variables had empty/redacted values (likely marked Sensitive on Vercel):`);
  for (const key of missingValues) {
    console.log(`  - ${key}`);
  }
  console.log("\nFor these, you must copy the values manually from the Vercel dashboard:");
  console.log("https://vercel.com/dashboard > upaharo > Settings > Environment Variables");
}
