import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, ArrowRight, ArrowLeft, Loader2, ShieldCheck, Smartphone, BarChart2, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const API_BASE = import.meta.env.VITE_API_URL || "https://api.kangpos.com";
const APP_URL  = "https://app.kangpos.com";
const STRIPE_PK = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "";

const stripePromise = STRIPE_PK ? loadStripe(STRIPE_PK) : null;

const Logo = () => (
  <div className="flex items-center gap-2">
    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center relative overflow-hidden">
      <div className="absolute left-[8px] top-[6px] bottom-[6px] w-[3px] bg-white rounded-full" />
      <div className="absolute left-[10px] top-[14px] w-[12px] h-[3px] bg-white rounded-full origin-left -rotate-45" />
      <div className="absolute left-[10px] top-[14px] w-[14px] h-[3px] bg-white rounded-full origin-left rotate-45" />
    </div>
    <span className="text-xl font-bold tracking-tight text-slate-900">KangPOS</span>
  </div>
);

const STEPS = ["Your details", "Choose a plan", "Payment"];

const PLANS = [
  {
    id: "weekly",
    name: "Flexible",
    price: "$29",
    per: "/ admin / week",
    yearly: false,
    features: ["Unlimited orders", "Full payroll & roster", "AI assistant", "Cancel anytime"],
  },
  {
    id: "yearly",
    name: "Annual",
    price: "$1,299",
    per: "/ year",
    yearly: true,
    badge: "Save 14%",
    features: ["Everything in Flexible", "Priority support", "Onboarding session", "Locked-in rate"],
  },
];

/* ─── Step 1: Business & Account Info ─── */
function StepDetails({ data, onChange, onNext }: {
  data: { businessName: string; ownerName: string; email: string; phone: string; password: string; confirm: string };
  onChange: (k: string, v: string) => void;
  onNext: () => void;
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!data.businessName.trim()) e.businessName = "Required";
    if (!data.ownerName.trim()) e.ownerName = "Required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) e.email = "Valid email required";
    if (data.password.length < 8) e.password = "At least 8 characters";
    if (data.password !== data.confirm) e.confirm = "Passwords don't match";
    setErrors(e);
    return !Object.keys(e).length;
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="businessName">Business name</Label>
          <Input id="businessName" value={data.businessName} onChange={e => onChange("businessName", e.target.value)}
            placeholder="Acme Café" className={errors.businessName ? "border-red-400" : ""} />
          {errors.businessName && <p className="text-xs text-red-500">{errors.businessName}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ownerName">Your name</Label>
          <Input id="ownerName" value={data.ownerName} onChange={e => onChange("ownerName", e.target.value)}
            placeholder="Sarah Johnson" className={errors.ownerName ? "border-red-400" : ""} />
          {errors.ownerName && <p className="text-xs text-red-500">{errors.ownerName}</p>}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">Email address</Label>
        <Input id="email" type="email" value={data.email} onChange={e => onChange("email", e.target.value)}
          placeholder="you@business.com" className={errors.email ? "border-red-400" : ""} />
        {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="phone">Phone <span className="text-slate-400 font-normal">(optional)</span></Label>
        <Input id="phone" type="tel" value={data.phone} onChange={e => onChange("phone", e.target.value)} placeholder="+61 4xx xxx xxx" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" value={data.password} onChange={e => onChange("password", e.target.value)}
            placeholder="Min. 8 characters" className={errors.password ? "border-red-400" : ""} />
          {errors.password && <p className="text-xs text-red-500">{errors.password}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm">Confirm password</Label>
          <Input id="confirm" type="password" value={data.confirm} onChange={e => onChange("confirm", e.target.value)}
            placeholder="Repeat password" className={errors.confirm ? "border-red-400" : ""} />
          {errors.confirm && <p className="text-xs text-red-500">{errors.confirm}</p>}
        </div>
      </div>
      <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white h-11 rounded-full" onClick={() => validate() && onNext()}>
        Continue <ArrowRight className="ml-2 w-4 h-4" />
      </Button>
    </div>
  );
}

/* ─── Step 2: Plan Selection ─── */
function StepPlan({ selected, onSelect, onNext, onBack }: {
  selected: string;
  onSelect: (id: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-4">
      {PLANS.map(plan => (
        <button key={plan.id} onClick={() => onSelect(plan.id)}
          className={cn(
            "w-full text-left p-5 rounded-2xl border-2 transition-all",
            selected === plan.id
              ? "border-blue-500 bg-blue-50"
              : "border-slate-200 hover:border-slate-300 bg-white"
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-slate-900">{plan.name}</span>
                {plan.badge && (
                  <span className="text-xs font-semibold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{plan.badge}</span>
                )}
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-slate-900">{plan.price}</span>
                <span className="text-slate-500 text-sm">{plan.per}</span>
              </div>
            </div>
            <div className={cn(
              "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-1",
              selected === plan.id ? "border-blue-500 bg-blue-500" : "border-slate-300"
            )}>
              {selected === plan.id && <Check className="w-3 h-3 text-white" />}
            </div>
          </div>
          <ul className="mt-3 space-y-1">
            {plan.features.map(f => (
              <li key={f} className="text-sm text-slate-600 flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-blue-500 shrink-0" /> {f}
              </li>
            ))}
          </ul>
        </button>
      ))}
      <div className="flex gap-3 pt-2">
        <Button variant="outline" className="flex-1 rounded-full" onClick={onBack}>
          <ArrowLeft className="mr-2 w-4 h-4" /> Back
        </Button>
        <Button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-full" onClick={onNext} disabled={!selected}>
          Continue <ArrowRight className="ml-2 w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

/* ─── Step 3: Payment (Stripe) ─── */
function StepPayment({ formData, onBack, onSuccess }: {
  formData: any;
  onBack: () => void;
  onSuccess: (uid: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);
    setError("");

    try {
      // 1. Create account + get SetupIntent client secret
      const res = await fetch(`${API_BASE}/api/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: formData.businessName,
          ownerName: formData.ownerName,
          email: formData.email,
          password: formData.password,
          phone: formData.phone,
          plan: formData.plan,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Signup failed");

      // Save token immediately so user is logged in
      localStorage.setItem("token", data.token);

      // 2. Confirm card setup (collect payment method for after-trial charging)
      if (data.clientSecret && stripe) {
        const cardElement = elements.getElement(CardElement);
        if (cardElement) {
          const { error: stripeErr, setupIntent } = await stripe.confirmCardSetup(data.clientSecret, {
            payment_method: {
              card: cardElement,
              billing_details: { name: formData.ownerName, email: formData.email },
            },
          });

          if (stripeErr) throw new Error(stripeErr.message);

          // 3. Tell backend to create subscription
          if (setupIntent?.payment_method) {
            await fetch(`${API_BASE}/api/register/confirm-payment`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                restaurantUid: data.restaurantUid,
                paymentMethodId: setupIntent.payment_method,
                plan: formData.plan,
              }),
            });
          }
        }
      }

      onSuccess(data.restaurantUid);
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const selectedPlan = PLANS.find(p => p.id === formData.plan);

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
        <p className="text-sm font-semibold text-blue-800 mb-0.5">
          {selectedPlan?.name} plan — 14-day free trial
        </p>
        <p className="text-xs text-blue-600">
          {selectedPlan?.price}{selectedPlan?.per}. No charge until your trial ends. Cancel anytime.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Card details</Label>
        <div className="border border-slate-200 rounded-xl p-3.5 bg-white focus-within:ring-2 focus-within:ring-blue-500/30 focus-within:border-blue-400 transition-all">
          <CardElement options={{
            style: {
              base: { fontSize: "15px", color: "#0f172a", fontFamily: "inherit", "::placeholder": { color: "#94a3b8" } },
              invalid: { color: "#ef4444" },
            },
            hidePostalCode: true,
          }} />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600">{error}</div>
      )}

      <div className="flex items-center gap-2 text-xs text-slate-500">
        <ShieldCheck className="w-4 h-4 text-slate-400 shrink-0" />
        Secured by Stripe. Your card details are never stored on our servers.
      </div>

      <div className="flex gap-3">
        <Button type="button" variant="outline" className="flex-1 rounded-full" onClick={onBack} disabled={loading}>
          <ArrowLeft className="mr-2 w-4 h-4" /> Back
        </Button>
        <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-full" disabled={loading || !stripe}>
          {loading ? <><Loader2 className="mr-2 w-4 h-4 animate-spin" /> Setting up…</> : "Start free trial"}
        </Button>
      </div>
    </form>
  );
}

/* ─── Success Screen ─── */
function SuccessScreen() {
  return (
    <div className="text-center py-4">
      <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <Check className="w-8 h-8 text-emerald-600" />
      </div>
      <h2 className="text-2xl font-bold text-slate-900 mb-2">You're all set!</h2>
      <p className="text-slate-500 mb-6">Your 14-day free trial has started. No charge until it ends.</p>
      <Button asChild className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-8 h-11">
        <a href={APP_URL}>Open KangPOS <ArrowRight className="ml-2 w-4 h-4" /></a>
      </Button>
      <p className="text-xs text-slate-400 mt-4">You'll be asked to log in with the email and password you just created.</p>
    </div>
  );
}

/* ─── Main Signup Page ─── */
export default function Signup() {
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({
    businessName: "", ownerName: "", email: "", phone: "",
    password: "", confirm: "", plan: "weekly",
  });

  const setField = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const whyItems = [
    { icon: Smartphone, text: "Run your business from any device" },
    { icon: BarChart2, text: "Real-time sales and cash reports" },
    { icon: Users, text: "Full payroll, roster, and staff management" },
    { icon: ShieldCheck, text: "Secure, Australian-hosted data" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Navbar */}
      <header className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
        <a href="/"><Logo /></a>
        <a href={APP_URL} className="text-sm text-slate-500 hover:text-slate-700 transition-colors">Already have an account? Log in →</a>
      </header>

      <div className="flex-1 flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">

          {/* Left — why KangPOS */}
          <div className="hidden lg:block pt-4">
            <p className="text-sm font-semibold text-blue-600 uppercase tracking-wide mb-3">Start free for 14 days</p>
            <h1 className="text-3xl font-bold text-slate-900 mb-4 leading-snug">
              The gen-next POS system for modern business.
            </h1>
            <p className="text-slate-500 mb-8">No credit card surprises. Cancel anytime. Set up in under 10 minutes.</p>
            <ul className="space-y-4">
              {whyItems.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-blue-600" />
                  </div>
                  <span className="text-slate-700 font-medium">{text}</span>
                </li>
              ))}
            </ul>
            <div className="mt-10 border-t border-slate-100 pt-8">
              <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-3">Trusted by businesses across Australia</p>
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-4 h-4 text-amber-400 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                ))}
                <span className="text-sm text-slate-500 ml-2">5.0 from early customers</span>
              </div>
            </div>
          </div>

          {/* Right — form */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 sm:p-8">
            {done ? <SuccessScreen /> : (
              <>
                {/* Step indicators */}
                <div className="flex items-center gap-2 mb-7">
                  {STEPS.map((s, i) => (
                    <div key={s} className="flex items-center gap-2">
                      <div className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                        i < step ? "bg-blue-600 text-white" :
                        i === step ? "bg-blue-600 text-white" :
                        "bg-slate-100 text-slate-400"
                      )}>
                        {i < step ? <Check className="w-3.5 h-3.5" /> : i + 1}
                      </div>
                      <span className={cn("text-xs font-medium hidden sm:block", i === step ? "text-slate-900" : "text-slate-400")}>{s}</span>
                      {i < STEPS.length - 1 && <div className={cn("flex-1 h-px w-6", i < step ? "bg-blue-300" : "bg-slate-100")} />}
                    </div>
                  ))}
                </div>

                <h2 className="text-xl font-bold text-slate-900 mb-1">
                  {step === 0 && "Create your account"}
                  {step === 1 && "Pick a plan"}
                  {step === 2 && "Add payment details"}
                </h2>
                <p className="text-sm text-slate-500 mb-6">
                  {step === 0 && "Free for 14 days — no credit card needed to get started."}
                  {step === 1 && "You won't be charged until your trial ends."}
                  {step === 2 && "Your card is saved but not charged until after your 14-day trial."}
                </p>

                {step === 0 && <StepDetails data={form} onChange={setField} onNext={() => setStep(1)} />}
                {step === 1 && (
                  <StepPlan selected={form.plan} onSelect={v => setField("plan", v)}
                    onNext={() => setStep(2)} onBack={() => setStep(0)} />
                )}
                {step === 2 && (
                  stripePromise ? (
                    <Elements stripe={stripePromise}>
                      <StepPayment formData={form} onBack={() => setStep(1)} onSuccess={() => setDone(true)} />
                    </Elements>
                  ) : (
                    // No Stripe configured — create account without payment
                    <StepPaymentFallback formData={form} onBack={() => setStep(1)} onSuccess={() => setDone(true)} />
                  )
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Fallback: no Stripe key configured ─── */
function StepPaymentFallback({ formData, onBack, onSuccess }: {
  formData: any;
  onBack: () => void;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: formData.businessName,
          ownerName: formData.ownerName,
          email: formData.email,
          password: formData.password,
          phone: formData.phone,
          plan: formData.plan,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Signup failed");
      localStorage.setItem("token", data.token);
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const selectedPlan = PLANS.find(p => p.id === formData.plan);

  return (
    <div className="space-y-5">
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
        <p className="text-sm font-semibold text-blue-800 mb-0.5">
          {selectedPlan?.name} plan — 14-day free trial
        </p>
        <p className="text-xs text-blue-600">No payment required to start. You'll be contacted to set up billing after your trial.</p>
      </div>
      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600">{error}</div>}
      <div className="flex gap-3">
        <Button variant="outline" className="flex-1 rounded-full" onClick={onBack} disabled={loading}>
          <ArrowLeft className="mr-2 w-4 h-4" /> Back
        </Button>
        <Button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-full" onClick={handleSubmit} disabled={loading}>
          {loading ? <><Loader2 className="mr-2 w-4 h-4 animate-spin" /> Creating account…</> : "Start free trial"}
        </Button>
      </div>
    </div>
  );
}
