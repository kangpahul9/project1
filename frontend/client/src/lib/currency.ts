import { queryClient } from "@/lib/queryClient";
import type { SystemSettings } from "@/hooks/use-settings";

const CURRENCY_MAP: Record<string, { symbol: string; locale: string }> = {
  AUD: { symbol: "$", locale: "en-AU" },
  INR: { symbol: "₹", locale: "en-IN" },
};

function getCurrencyConfig() {
  const settings = queryClient.getQueryData<SystemSettings>(["settings"]);
  const code = settings?.currency_code ?? "AUD";
  return CURRENCY_MAP[code] ?? CURRENCY_MAP["AUD"];
}

export function getCurrencySymbol(): string {
  return getCurrencyConfig().symbol;
}

/** Use inside mutation callbacks / hook toast messages (no React hook needed). */
export function formatCurrency(amount: number | string): string {
  const n = Number(amount);
  const { symbol, locale } = getCurrencyConfig();
  return `${symbol}${n.toLocaleString(locale)}`;
}
