import { toast as toastify } from "react-toastify";

// ================= CORE =================

export const toast = (message: string) => {
  return toastify(message);
};

// ================= VARIANTS =================

export const toastSuccess = (message: string) => {
  return toastify.success(message);
};

export const toastError = (message: string) => {
  return toastify.error(message);
};

export const toastWarning = (message: string) => {
  return toastify.warn(message);
};

export const toastInfo = (message: string) => {
  return toastify.info(message);
};

// ================= PROMISE =================

export const toastPromise = (
  promise: Promise<any>,
  messages: {
    loading: string;
    success: string | ((data: any) => string);
    error: string | ((err: any) => string);
  }
) => {
  return toastify.promise(promise, {
    pending: messages.loading,
    success: {
      render({ data }) {
        return typeof messages.success === "function"
          ? messages.success(data)
          : messages.success;
      },
    },
    error: {
      render({ data }) {
        return typeof messages.error === "function"
          ? messages.error(data)
          : messages.error;
      },
    },
  });
};

// ================= HOOK =================

export function useToast() {
  return {
    toast,
    success: toastSuccess,
    error: toastError,
    warning: toastWarning,
    info: toastInfo,
    promise: toastPromise,
  };
}