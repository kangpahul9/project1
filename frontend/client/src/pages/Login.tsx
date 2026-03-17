import { useState } from "react";
import { Building2, User, Lock, ArrowRight } from "lucide-react";
import { useLogin } from "@/hooks/use-auth";
import { useEffect } from "react";

export default function Login() {
const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [restaurantUid, setRestaurantUid] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { mutate: login } = useLogin();

//   useEffect(() => {
//   const saved = localStorage.getItem("restaurantUid");
//   if (saved) setrestaurantUid(saved);
// }, []);

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setError("");

  if (!email.trim() || !password.trim() || !restaurantUid.trim()) {
    setError("All fields are required.");
    return;
  }

  setLoading(true);

  login(
    {
      restaurantUid,
      email: email,
      password
    },
    {
      onError: (err: any) => {
        setError(err.message || "Login failed");
        setLoading(false);
      },
      onSuccess: () => {
        setLoading(false);
        localStorage.setItem("restaurantUid", restaurantUid);
      }
    }
  );
};

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-blue-50 p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center mb-5 shadow-lg shadow-violet-500/20">
            <Building2 className="w-7 h-7 text-white" strokeWidth={1.5} />
          </div>
          <h1 className="text-3xl font-semibold text-gray-900">Welcome</h1>
          <p className="mt-1.5 text-sm text-gray-600">Sign in to your restaurant terminal</p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-lg shadow-gray-100/50 border border-gray-100 p-8">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Restaurant ID */}
            <div className="flex flex-col gap-2">
              <label htmlFor="restaurantUid" className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                UID
              </label>
              <div className="relative">
                <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  autoFocus
                  id="restaurantUid"
                  type="text"
                  value={restaurantUid}
                  onChange={(e) => setRestaurantUid(e.target.value)}
                  placeholder="REST-001"
                  autoComplete="organization"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 hover:bg-white hover:border-gray-300 pl-10 pr-4 py-3 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-0 focus:border-transparent focus:bg-white transition duration-150"
                />
              </div>
            </div>

            {/* email */}
            <div className="flex flex-col gap-2">
              <label htmlFor="username" className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                email
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  id="username"
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  autoComplete="email"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 hover:bg-white hover:border-gray-300 pl-10 pr-4 py-3 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-0 focus:border-transparent focus:bg-white transition duration-150"
                />
              </div>
            </div>

            {/* Password */}
            <div className="flex flex-col gap-2">
              <label htmlFor="password" className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 hover:bg-white hover:border-gray-300 pl-10 pr-12 py-3 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-0 focus:border-transparent focus:bg-white transition duration-150"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-500 hover:text-gray-700 transition duration-150"
                  tabIndex={-1}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-red-50 border border-red-200">
                <div className="mt-0.5 w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                <p className="text-xs text-red-700 font-medium">{error}</p>
              </div>
            )}

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-600 hover:to-violet-700 active:from-violet-700 active:to-violet-800 text-white font-semibold text-sm py-3 transition duration-150 disabled:opacity-60 disabled:cursor-not-allowed shadow-md shadow-violet-500/30 hover:shadow-lg hover:shadow-violet-500/40"
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
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
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-gray-600">
          Need help? <span className="text-violet-600 font-medium cursor-pointer hover:text-violet-700">Contact support</span>
        </p>
      </div>
    </div>
  );
}