import { useState, useEffect, useRef } from "react";
import { post, get } from "@/lib/api";

export type EftposStatus = "idle" | "pending" | "approved" | "declined" | "cancelled" | "error";

interface ChargeResult {
  transactionId: string;
  provider: string;
}

interface PollResult {
  status: string;
}

export function useEftpos() {
  const [status, setStatus] = useState<EftposStatus>("idle");
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => {
    return () => stopPolling();
  }, []);

  const charge = async (amountCents: number): Promise<boolean> => {
    setStatus("pending");
    setError(null);
    setTransactionId(null);
    stopPolling();

    try {
      const res = await post<ChargeResult>("/eftpos/charge", { amountCents });
      setTransactionId(res.transactionId);

      return new Promise((resolve) => {
        pollRef.current = setInterval(async () => {
          try {
            const poll = await get<PollResult>(`/eftpos/status/${res.transactionId}`);
            const s = poll.status?.toUpperCase();

            if (s === "APPROVED") {
              stopPolling();
              setStatus("approved");
              resolve(true);
            } else if (s === "DECLINED" || s === "CANCELLED" || s === "ERROR") {
              stopPolling();
              setStatus(s.toLowerCase() as EftposStatus);
              setError(`Payment ${s.toLowerCase()} by terminal`);
              resolve(false);
            }
            // PENDING → keep polling
          } catch {
            // keep polling on transient errors
          }
        }, 2500);

        // 3-minute timeout
        setTimeout(() => {
          if (pollRef.current) {
            stopPolling();
            setStatus("error");
            setError("Terminal did not respond in time. Please try again.");
            resolve(false);
          }
        }, 3 * 60 * 1000);
      });
    } catch (err: any) {
      setStatus("error");
      setError(err?.message || "Failed to reach terminal");
      return false;
    }
  };

  const reset = () => {
    stopPolling();
    setStatus("idle");
    setTransactionId(null);
    setError(null);
  };

  return { status, transactionId, error, charge, reset };
}
