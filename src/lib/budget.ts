// Per-instance daily spend guard. The OpenAI dashboard budget is the real hard cap.
const LIMIT = Number(process.env.DAILY_CARD_LIMIT ?? 300);
let day = new Date().toISOString().slice(0, 10);
let used = 0;
export function takeBudget(): boolean {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== day) { day = today; used = 0; }
  if (used >= LIMIT) return false;
  used++;
  return true;
}
