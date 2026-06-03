import * as React from "react";

// ================= CONFIG =================

const MOBILE_QUERY = "(max-width: 767px)";

// ================= HOOK =================

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean>(() => {
    // 🔥 safe initial value
    if (typeof window === "undefined") return false;
    return window.matchMedia(MOBILE_QUERY).matches;
  });

  React.useEffect(() => {
    const mediaQuery = window.matchMedia(MOBILE_QUERY);

    const handleChange = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
    };

    // 🔥 modern + fallback
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
    } else {
      mediaQuery.addListener(handleChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", handleChange);
      } else {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, []);

  return isMobile;
}