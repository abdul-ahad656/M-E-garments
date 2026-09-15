import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const roots = [
  "lib/api-client-react/src/generated",
  "lib/api-zod/src/generated",
];

async function collectTypeScriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return collectTypeScriptFiles(entryPath);
      return entry.isFile() && entry.name.endsWith(".ts") ? [entryPath] : [];
    }),
  );
  return files.flat();
}

for (const root of roots) {
  for (const file of await collectTypeScriptFiles(root)) {
    const content = await readFile(file, "utf8");
    const normalized = `${content.trimEnd()}\n`;
    if (normalized !== content) {
      await writeFile(file, normalized);
    }
  }
}