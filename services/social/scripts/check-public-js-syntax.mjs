import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import * as acorn from "acorn";

const publicJsDir = path.join(process.cwd(), "public/js");
const failures = [];

function jsFiles(dir) {
  if (!fs.existsSync(dir)) {
    failures.push({
      file: "public/js",
      message: "public/js directory does not exist",
    });
    return [];
  }

  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...jsFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      found.push(fullPath);
    }
  }
  return found;
}

for (const filePath of jsFiles(publicJsDir)) {
  const source = fs.readFileSync(filePath, "utf8");
  try {
    acorn.parse(source, {
      allowHashBang: true,
      ecmaVersion: "latest",
      sourceType: "script",
    });
  } catch (error) {
    const start = Math.max(0, error.pos - 80);
    const end = Math.min(source.length, error.pos + 80);
    failures.push({
      file: path.relative(process.cwd(), filePath).replace(/\\/g, "/"),
      message: error.message,
      line: error.loc?.line,
      column: error.loc?.column,
      context: source.slice(start, end),
    });
  }
}

if (failures.length > 0) {
  console.error("Generated public JS syntax check failed:");
  for (const failure of failures) {
    const location =
      failure.line == null ? "" : `:${failure.line}:${failure.column}`;
    console.error(`- ${failure.file}${location} ${failure.message}`);
    if (failure.context) {
      console.error(`  ${failure.context}`);
    }
  }
  process.exit(1);
}

console.log(`Generated public JS syntax check passed (${jsFiles(publicJsDir).length} files).`);
