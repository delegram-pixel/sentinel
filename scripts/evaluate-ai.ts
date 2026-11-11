import { readFile } from "node:fs/promises";
import { evaluateModelOutputs } from "@/modules/ai/application/model-evaluation";
const fixture = process.argv[2] ?? "tests/fixtures/ai-model-evaluation.json";
const result = evaluateModelOutputs(JSON.parse(await readFile(fixture, "utf8")));
process.stdout.write(JSON.stringify(result, null, 2) + "\n");
if (result.results.some((item) => !item.expectedOutcomeMatched)) process.exitCode = 1;
