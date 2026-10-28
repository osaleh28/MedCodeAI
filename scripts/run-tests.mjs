// Compile the real TypeScript unit-test graph and run it in this Node process.
// This avoids esbuild binaries and child processes on managed development PCs.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("..", import.meta.url));
const outputRoot = path.join(root, ".npm-cache", "unit-tests");
function compileDirectory(relative) {
  for (const entry of fs.readdirSync(path.join(root, relative), { withFileTypes: true })) {
    const file = path.join(relative, entry.name);
    if (entry.isDirectory()) compileDirectory(file);
    else if (file.endsWith(".ts") && !file.endsWith(".d.ts")) {
      const target = path.join(outputRoot, file.replace(/\.ts$/, ".js"));
      const result = ts.transpileModule(fs.readFileSync(path.join(root, file), "utf8"), {
        fileName: file,
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
      });
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, result.outputText);
    }
  }
}
compileDirectory("src/lib");
compileDirectory("tests");
for (const name of fs.readdirSync(path.join(root, "tests")).filter((name) => name.endsWith(".test.ts")).sort()) {
  await import(pathToFileURL(path.join(outputRoot, "tests", name.replace(/\.ts$/, ".js"))).href);
}
