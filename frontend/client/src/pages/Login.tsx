import { useState } from "react";
import { Store, User, Lock, ArrowRight, Eye, EyeOff, Shield } from "lucide-react";
import { useLogin } from "@/hooks/use-auth";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [restaurantUid, setRestaurantUid] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const { mutate: login, isPending } = useLogin();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password.trim() || !restaurantUid.trim()) {
      setError("All fields are required.");
      return;
    }
    login(
      { restaurantUid, email, password },
      {
        onError: (err: unknown) => {
          setError(err instanceof Error ? err.message : "Login failed");
        },
        onSuccess: () => {
          localStorage.setItem("restaurantUid", restaurantUid);
        },
      }
    );
  };

  return (
    <div className="min-h-screen w-full flex bg-background">
      {/* Left decorative panel */}
      <div className="hidden lg:flex flex-col justify-between w-[420px] bg-sidebar p-10 flex-shrink-0">
        <div className="flex items-center gap-3">
          <svg width="36" height="36" viewBox="0 0 90 90" fill="none" aria-hidden="true">
            <rect width="90" height="90" rx="16" fill="#2563eb"/>
            <path d="M 28 20 L 28 70" stroke="white" strokeWidth="9" strokeLinecap="round"/>
            <path d="M 62 20 L 28 45" stroke="white" strokeWidth="9" strokeLinecap="round"/>
            <path d="M 36 40 L 62 70" stroke="white" strokeWidth="9" strokeLinecap="round"/>
          </svg>
          <span className="text-white text-base font-bold tracking-tight">
            Kang<span className="text-[#5b8cff]">POS</span>
          </span>
        </div>

        <div>
          <div className="w-14 h-14 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center mb-6">
            <Shield className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-white leading-tight mb-3">
            Secure Business<br />Management
          </h2>
          <p className="text-sidebar-foreground/50 text-sm leading-relaxed">
            Your all-in-one point of sale and business operations platform — built for speed, reliability, and control.
          </p>
          <div className="mt-8 space-y-3">
            {[
              "Real-time sales & reporting",
              "Multi-role staff management",
              "Inventory & vendor tracking",
              "Payroll & attendance control",
            ].map((feat) => (
              <div key={feat} className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                <span className="text-sidebar-foreground/55 text-sm">{feat}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-sidebar-foreground/28 text-xs">© 2025 KangPOS. All rights reserved.</p>
      </div>

      {/* Right login panel */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-[380px]">
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <svg width="36" height="36" viewBox="0 0 90 90" fill="none" aria-hidden="true">
              <rect width="90" height="90" rx="16" fill="#2563eb"/>
              <path d="M 28 20 L 28 70" stroke="white" strokeWidth="9" strokeLinecap="round"/>
              <path d="M 62 20 L 28 45" stroke="white" strokeWidth="9" strokeLinecap="round"/>
              <path d="M 36 40 L 62 70" stroke="white" strokeWidth="9" strokeLinecap="round"/>
            </svg>
            <span className="text-foreground text-base font-bold tracking-tight">
              Kang<span className="text-primary">POS</span>
            </span>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-foreground">Sign in</h1>
            <p className="text-muted-foreground text-sm mt-1.5">Enter your credentials to access the terminal</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Business UID
              </label>
              <div className="relative">
                <Store className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <input
                  autoFocus
                  type="text"
                  value={restaurantUid}
                  onChange={(e) => setRestaurantUid(e.target.value)}
                  placeholder="e.g. REST-001"
                  autoComplete="organization"
                  className="w-full h-10 rounded-lg border border-border bg-card pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Email
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  className="w-full h-10 rounded-lg border border-border bg-card pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className="w-full h-10 rounded-lg border border-border bg-card pl-10 pr-11 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2.5 p-3 rounded-lg bg-destructive/8 border border-destructive/20">
                <div className="w-1.5 h-1.5 rounded-full bg-destructive flex-shrink-0" />
                <p className="text-xs text-destructive font-medium">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="w-full h-10 flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold transition hover:opacity-90 active:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-primary/25 mt-2"
            >
              {isPending ? (
                <>
                  <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Need access?{" "}
            <span className="text-primary font-medium cursor-pointer hover:underline">Contact your administrator</span>
          </p>
        </div>
      </div>
    </div>
  );
}
