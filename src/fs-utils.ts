import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import fg from "fast-glob";

export function toPosix(filePath: string): string {
  return filePath.split(path.sep).join("/");
}

export function relativeToRoot(root: string, filePath: string): string {
  return toPosix(path.relative(root, filePath));
}

export function expandPatterns(
  root: string,
  patterns: string[],
  ignorePatterns: string[] = [],
): string[] {
  const files = new Set<string>();
  const literalIgnores = new Set(ignorePatterns.map((pattern) => toPosix(pattern)));

  for (const pattern of patterns) {
    const literalPath = path.join(root, pattern);
    if (existsSync(literalPath) && lstatSync(literalPath).isFile()) {
      files.add(relativeToRoot(root, literalPath));
      continue;
    }

    const matches = fg.sync(pattern, {
      cwd: root,
      ignore: ignorePatterns,
      dot: true,
      onlyFiles: true,
      unique: true,
    });

    for (const match of matches) {
      files.add(toPosix(match));
    }
  }

  return [...files].filter((file) => !literalIgnores.has(file)).sort();
}

export function parseRuntimeObligationsAnnotation(source: string): string[] {
  const match = source.match(/^\s*\/\/\s*runtime-(?:behaviors|obligations):\s*([^\r\n]+)/m);
  if (!match) {
    return [];
  }

  return match[1]
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function ensureDirectoryForFile(filePath: string): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
}

export function writeTextFile(filePath: string, contents: string): void {
  ensureDirectoryForFile(filePath);
  writeFileSync(filePath, contents);
}

export function copyTextFile(sourcePath: string, destinationPath: string): void {
  writeTextFile(destinationPath, readFileSync(sourcePath, "utf8"));
}
