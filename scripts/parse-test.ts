import { parseHTML } from "linkedom";
import { Readability } from "@mozilla/readability";
const para = "Meta said on Tuesday it is rolling out an AI agent that sets up ad campaigns automatically for advertisers. ".repeat(12);
const html = `<html><head><title>Test story</title></head><body><nav>menu</nav><article><h1>Test story</h1><p>${para}</p><p>${para}</p></article><footer>foot</footer></body></html>`;
const { document } = parseHTML(html);
const a = new Readability(document as unknown as Document).parse();
console.log(a?.title, (a?.textContent ?? "").replace(/\s+/g, " ").trim().length > 800 ? "parse ok" : "parse FAILED");
