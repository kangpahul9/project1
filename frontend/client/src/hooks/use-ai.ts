import { useMutation } from "@tanstack/react-query";
import { post } from "@/lib/api";
import { toastError } from "@/hooks/use-toast";

// ================= TYPES =================

export interface AIMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AIResponse {
  answer: string;
  data?: any;
}

// ================= MAIN AI HOOK =================

export function useAI() {
  return useMutation({
    mutationFn: async ({
      message,
      history = [],
    }: {
      message: string;
      history?: AIMessage[];
    }) => {
      const res = await post<AIResponse>("/ai/chat", {
        message,
        history,
      });

      return res;
    },

    onError: (err: any) => {
      toastError(err?.message || "AI request failed");
    },
  });
}

export function useAIChat() {
  const ai = useAI();

  const sendMessage = async (
    message: string,
    history: AIMessage[]
  ) => {
    const res = await ai.mutateAsync({ message, history });

    return {
      role: "assistant",
      content: res.answer,
    } as AIMessage;
  };

  return {
    sendMessage,
    isLoading: ai.isPending,
  };
}