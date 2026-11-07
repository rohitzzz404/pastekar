// Prints the value for TEAM_PASSCODE_HASH. Usage:
//   npm run passcode:hash            (prompts on stdin)
//   printf '%s' "$PASSCODE" | npm run passcode:hash
// Avoid passing the passcode as an argument, since shells keep history.
import { createInterface } from "node:readline/promises";
import { hashSecret } from "../src/lib/auth";

async function main() {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  const passcode = (await rl.question("Team passcode: ")).replace(/\r?\n$/, "");
  rl.close();
  if (passcode.length < 12) {
    console.error("Use at least 12 characters. A long random passcode is best.");
    process.exit(1);
  }
  console.log(await hashSecret(passcode));
}

main();
