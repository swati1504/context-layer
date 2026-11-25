// Row 13 fetch test: node/tsx scripts/fetch-test.ts <url> [<url>...]
import { fetchArticle } from "../src/lib/fetchArticle";
(async () => {
  for (const u of process.argv.slice(2)) {
    try {
      const a = await fetchArticle(u);
      console.log("OK   ", a.sourceName, a.text.length, "chars", u);
    } catch (e: any) {
      console.log("FAIL ", e.code ?? "", e.message, u);
    }
  }
})();
