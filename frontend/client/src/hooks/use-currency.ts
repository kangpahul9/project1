import { useSettings } from "@/hooks/use-settings";

const CURRENCY_MAP: Record<string, { symbol: string; locale: string }> = {
  AUD: { symbol: "$", locale: "en-AU" },
  INR: { symbol: "₹", locale: "en-IN" },
};

export const DENOMS_INR = [500, 200, 100, 50, 20, 10, 5, 2, 1];
export const DENOMS_AUD = [100, 50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05];

export function useCurrency() {
  const { data: settings } = useSettings();
  const code = settings?.currency_code ?? "AUD";
  const { symbol, locale } = CURRENCY_MAP[code] ?? CURRENCY_MAP["AUD"];

  const format = (amount: number | string): string => {
    const n = Number(amount);
    return `${symbol}${n.toLocaleString(locale)}`;
  };

  return { symbol, code, locale, format };
}

export function useDenominations(): number[] {
  const { code } = useCurrency();
  return code === "AUD" ? DENOMS_AUD : DENOMS_INR;
}
