import { quoteExists } from "../src/lib/verify";
const art = "Meta said on Tuesday that it is “rolling out an AI agent that sets up ad campaigns automatically” for all advertisers, starting with small businesses in the US.";
const cases: [string, boolean][] = [
  ["rolling out an AI agent that sets up ad campaigns automatically", true],
  ['"Rolling out an AI agent that sets up ad campaigns automatically"', true],
  ["rolling out an AI agent that sets up ad campaigns for free", false],
  ["AI agent", false],
];
let bad = 0;
for (const [q, want] of cases) { const got = quoteExists(art, q); if (got !== want) { bad++; console.log("FAIL", q, got); } }
console.log(bad ? "FAILED" : "verify: all passed");
process.exit(bad ? 1 : 0);
