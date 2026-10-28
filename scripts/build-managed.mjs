// Keep the opt-in verification build separate from a running dev server and
// use Node worker threads where subprocess execution is restricted.
import { fileURLToPath } from "node:url";
process.env.MEDCODE_BUILD_WORKER_THREADS = "1";
const cli = import.meta.resolve("next/dist/bin/next");
process.argv = [process.execPath, fileURLToPath(cli), "build"];
await import(cli);
