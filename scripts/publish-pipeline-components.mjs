#!/usr/bin/env node
/**
 * Publish packages/pipeline-components to github.com/ethomasii/eltpulse-pipeline-components
 *
 * Usage:
 *   node scripts/export-pipeline-components-catalog.mjs
 *   node scripts/publish-pipeline-components.mjs
 *
 * Uses SSH (git@github.com) as ethomasii. If the standalone repo does not exist yet,
 * falls back to branch pipeline-components-catalog on ethomasii/datapulse.
 */

import { execSync } from "child_process";
import { cpSync, existsSync, mkdirSync, rmSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "packages/pipeline-components");
const repo = process.env.PIPELINE_COMPONENTS_REPO ?? "ethomasii/eltpulse-pipeline-components";
const branch = process.env.PIPELINE_COMPONENTS_BRANCH ?? "main";
const fallbackRepo = process.env.PIPELINE_COMPONENTS_FALLBACK ?? "ethomasii/datapulse";
const fallbackBranch =
  process.env.PIPELINE_COMPONENTS_FALLBACK_BRANCH ?? "pipeline-components-catalog";
const sshRemote = `git@github.com:${repo}.git`;
const tmp = join(root, ".tmp-pipeline-components-push");

function ghUser() {
  try {
    return execSync("gh api user --jq .login", { encoding: "utf8", env: ghEnv() }).trim();
  } catch {
    return "";
  }
}

function ghEnv() {
  if (process.env.GH_TOKEN || process.env.GITHUB_TOKEN) return process.env;
  try {
    const token = execSync(
      "printf 'protocol=https\\nhost=github.com\\n\\n' | git credential fill | awk -F= '/^password=/{print $2}'",
      { encoding: "utf8" }
    ).trim();
    if (token) return { ...process.env, GH_TOKEN: token };
  } catch {
    /* ignore */
  }
  return process.env;
}

function remoteExists(remote) {
  try {
    execSync(`git ls-remote ${remote} HEAD`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

console.log("Exporting latest catalog from datapulse…");
execSync("node scripts/export-pipeline-components-catalog.mjs", { cwd: root, stdio: "inherit" });

rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });
cpSync(src, tmp, { recursive: true });

const run = (cmd, opts = {}) => execSync(cmd, { cwd: tmp, stdio: "inherit", ...opts });

const activeGh = ghUser();
if (activeGh && activeGh !== "ethomasii") {
  console.log(`Using SSH as ethomasii (gh API: ${activeGh}).`);
}

let repoExists = remoteExists(sshRemote);
if (!repoExists) {
  // Try gh create when authenticated as ethomasii, or with explicit PAT.
  const createToken = process.env.PIPELINE_COMPONENTS_GH_TOKEN;
  const canCreate = activeGh === "ethomasii" || createToken;
  if (canCreate) {
    console.log(`Creating ${repo}…`);
    try {
      execSync(
        `gh repo create ${repo} --public --description "Native executable pipeline components for eltPulse declarative v2"`,
        {
          stdio: "inherit",
          env: createToken ? { ...process.env, GH_TOKEN: createToken } : ghEnv(),
        }
      );
      repoExists = remoteExists(sshRemote);
    } catch {
      /* fall through */
    }
  }
}

run("git init");
run("git add -A");
try {
  run('git commit -m "sync from datapulse monorepo"');
} catch {
  console.log("Nothing to commit.");
}
run(`git branch -M ${branch}`);

if (repoExists) {
  run(`git remote add origin ${sshRemote}`);
  run(`git push -u origin ${branch}`);
  console.log(`Published https://github.com/${repo}`);
  process.exit(0);
}

console.log(`${repo} not found — publishing to ${fallbackRepo} branch ${fallbackBranch}…`);
const fallbackRemote = `git@github.com:${fallbackRepo}.git`;
run(`git push --force ${fallbackRemote} ${branch}:refs/heads/${fallbackBranch}`);
console.log(`Published https://github.com/${fallbackRepo}/tree/${fallbackBranch}`);
