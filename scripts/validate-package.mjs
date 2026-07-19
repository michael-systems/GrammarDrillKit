import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDonorData, validateDraftPackage } from './validate-content.mjs';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

function parseArgs(argv) {
  const args = { files: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--module') args.moduleId = argv[++index];
    else if (value === '--start') args.start = Number(argv[++index]);
    else if (value === '--end') args.end = Number(argv[++index]);
    else args.files.push(value);
  }
  if (!args.moduleId || !Number.isInteger(args.start) || !Number.isInteger(args.end) || args.files.length === 0) {
    throw new Error('Usage: node scripts/validate-package.mjs --module <id> --start <n> --end <n> <package.json> [...]');
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const blueprint = JSON.parse(fs.readFileSync(path.join(ROOT, 'reports', 'content-blueprint.json'), 'utf8'));
const donor = parseDonorData(fs.readFileSync(path.join(ROOT, 'donor', 'PhrasalVerbsQuiz-index.html'), 'utf8'));
const questions = args.files.flatMap((file) => {
  const parsed = JSON.parse(fs.readFileSync(path.resolve(ROOT, file), 'utf8'));
  if (!Array.isArray(parsed)) throw new TypeError(`${file} must contain a JSON array.`);
  return parsed;
});
const report = validateDraftPackage({
  questions,
  moduleId: args.moduleId,
  start: args.start,
  end: args.end,
  blueprint,
  donor,
});

console.log(`Package validator: ${report.valid ? 'PASS' : 'FAIL'}`);
console.log(`${report.moduleId} ${report.range.start}-${report.range.end}: questions ${report.totals.questions}; errors ${report.totals.errors}; warnings ${report.totals.warnings}`);
for (const issue of report.errors) console.error(`ERROR [${issue.code}] ${issue.message}`);
for (const issue of report.warnings) console.warn(`WARN [${issue.code}] ${issue.message}`);
if (!report.valid) process.exitCode = 1;
