// CLI-only TypeScript/alias loader using the compiler already installed in this repo.
import { readFile, access } from "node:fs/promises";
import { resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only")
    return { url: "data:text/javascript,export{}", shortCircuit: true };
  if (
    specifier.startsWith("@/") ||
    (specifier.startsWith(".") && context.parentURL?.endsWith(".ts"))
  ) {
    const base = specifier.startsWith("@/")
      ? resolvePath(process.cwd(), "src", specifier.slice(2))
      : fileURLToPath(new URL(specifier, context.parentURL));
    for (const path of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`]) {
      try {
        await access(path);
        if (path.endsWith(".ts") || path.endsWith(".tsx") || path.endsWith(".js"))
          return { url: pathToFileURL(path).href, shortCircuit: true };
      } catch {}
    }
  }
  return nextResolve(specifier, context);
}
export async function load(url, context, nextLoad) {
  if (url.endsWith(".ts") || url.endsWith(".tsx")) {
    const source = await readFile(fileURLToPath(url), "utf8");
    return {
      format: "module",
      shortCircuit: true,
      source: ts.transpileModule(source, {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
          jsx: ts.JsxEmit.ReactJSX,
        },
      }).outputText,
    };
  }
  return nextLoad(url, context);
}
