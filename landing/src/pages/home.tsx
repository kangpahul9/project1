import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  Menu, X, ArrowRight, Check, Activity, Users, DollarSign, 
  PieChart, Utensils, Coins, Calendar, Sparkles, BarChart, 
  FileSpreadsheet, Globe, Settings, Play, CheckCircle, 
  Clock, Shield, Heart, Mail, MessageSquare, MapPin 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const APP_URL = "https://app.kangpos.com";

const Logo = () => (
  <div className="flex items-center gap-2">
    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center relative overflow-hidden">
      <div className="absolute left-[8px] top-[6px] bottom-[6px] w-[3px] bg-white rounded-full"></div>
      <div className="absolute left-[10px] top-[14px] w-[12px] h-[3px] bg-white rounded-full origin-left -rotate-45"></div>
      <div className="absolute left-[10px] top-[14px] w-[14px] h-[3px] bg-white rounded-full origin-left rotate-45"></div>
    </div>
    <span className="text-xl font-bold tracking-tight font-heading text-white">KangPOS</span>
  </div>
);

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollTo = (id: string) => {
    setMobileMenuOpen(false);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled ? "bg-slate-950/90 backdrop-blur-md border-b border-white/10 py-3" : "bg-transparent py-5"}`}>
      <div className="container mx-auto px-4 md:px-6 flex items-center justify-between">
        <a href="#" onClick={(e) => { e.preventDefault(); scrollTo("hero"); }}>
          <Logo />
        </a>
        
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
          <button onClick={() => scrollTo("features")} className="hover:text-white transition-colors">Features</button>
          <button onClick={() => scrollTo("how-it-works")} className="hover:text-white transition-colors">How it works</button>
          <button onClick={() => scrollTo("pricing")} className="hover:text-white transition-colors">Pricing</button>
          <button onClick={() => scrollTo("about")} className="hover:text-white transition-colors">About</button>
          <button onClick={() => scrollTo("contact")} className="hover:text-white transition-colors">Contact</button>
        </div>

        <div className="hidden md:flex items-center gap-4">
          <a href={APP_URL} data-testid="link-login" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">
            Login
          </a>
          <Button asChild className="bg-blue-600 hover:bg-blue-700 text-white border-0">
            <a href={APP_URL} data-testid="btn-nav-get-started">Get Started</a>
          </Button>
        </div>

        <button className="md:hidden text-white" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          {mobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-slate-950 border-b border-white/10 p-4 flex flex-col gap-4">
          <button onClick={() => scrollTo("features")} className="text-left text-slate-300 py-2">Features</button>
          <button onClick={() => scrollTo("how-it-works")} className="text-left text-slate-300 py-2">How it works</button>
          <button onClick={() => scrollTo("pricing")} className="text-left text-slate-300 py-2">Pricing</button>
          <button onClick={() => scrollTo("about")} className="text-left text-slate-300 py-2">About</button>
          <button onClick={() => scrollTo("contact")} className="text-left text-slate-300 py-2">Contact</button>
          <hr className="border-white/10" />
          <a href={APP_URL} className="text-slate-300 py-2">Login</a>
          <Button asChild className="bg-blue-600 w-full mt-2">
            <a href={APP_URL}>Get Started</a>
          </Button>
        </div>
      )}
    </nav>
  );
};

const DashboardMockup = () => (
  <div className="relative rounded-xl overflow-hidden border border-white/10 bg-slate-950 shadow-2xl aspect-[16/10] max-w-4xl mx-auto flex text-left font-sans select-none">
    {/* Sidebar */}
    <div className="w-48 lg:w-56 bg-slate-900 border-r border-white/5 p-4 hidden sm:flex flex-col">
      <div className="flex items-center gap-2 mb-8 px-2 text-white">
        <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center relative overflow-hidden">
          <div className="absolute left-[6px] top-[4px] bottom-[4px] w-[2px] bg-white rounded-full"></div>
          <div className="absolute left-[7px] top-[10px] w-[8px] h-[2px] bg-white rounded-full origin-left -rotate-45"></div>
          <div className="absolute left-[7px] top-[10px] w-[10px] h-[2px] bg-white rounded-full origin-left rotate-45"></div>
        </div>
        <span className="font-bold text-sm font-heading">KangPOS</span>
      </div>
      <div className="space-y-1">
        <div className="flex items-center gap-3 px-2 py-2 bg-blue-600/20 text-blue-400 rounded-md text-sm font-medium"><Activity className="w-4 h-4" /> Dashboard</div>
        <div className="flex items-center gap-3 px-2 py-2 text-slate-400 hover:text-slate-200 rounded-md text-sm font-medium"><Utensils className="w-4 h-4" /> Orders</div>
        <div className="flex items-center gap-3 px-2 py-2 text-slate-400 hover:text-slate-200 rounded-md text-sm font-medium"><Coins className="w-4 h-4" /> Cash Management</div>
        <div className="flex items-center gap-3 px-2 py-2 text-slate-400 hover:text-slate-200 rounded-md text-sm font-medium"><Users className="w-4 h-4" /> Staff & Roster</div>
        <div className="flex items-center gap-3 px-2 py-2 text-slate-400 hover:text-slate-200 rounded-md text-sm font-medium"><Sparkles className="w-4 h-4" /> AI Insights</div>
      </div>
    </div>
    
    {/* Main Content */}
    <div className="flex-1 p-4 lg:p-6 bg-slate-950 flex flex-col h-full overflow-hidden">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-white text-lg font-semibold font-heading">Today's Overview</h2>
        <div className="flex gap-2">
          <div className="bg-slate-800 text-slate-300 text-xs px-3 py-1.5 rounded-md flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500"></span> Live
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-slate-900 border border-white/5 p-4 rounded-lg">
          <div className="text-slate-400 text-xs mb-1 flex items-center gap-2"><DollarSign className="w-3 h-3" /> Revenue</div>
          <div className="text-white text-2xl font-bold font-heading">$3,842.50</div>
          <div className="text-green-400 text-xs mt-1">+12% vs last week</div>
        </div>
        <div className="bg-slate-900 border border-white/5 p-4 rounded-lg">
          <div className="text-slate-400 text-xs mb-1 flex items-center gap-2"><Utensils className="w-3 h-3" /> Orders</div>
          <div className="text-white text-2xl font-bold font-heading">147</div>
          <div className="text-green-400 text-xs mt-1">42 Dine-in, 105 Takeaway</div>
        </div>
        <div className="bg-slate-900 border border-white/5 p-4 rounded-lg">
          <div className="text-slate-400 text-xs mb-1 flex items-center gap-2"><Coins className="w-3 h-3" /> Cash in Till</div>
          <div className="text-white text-2xl font-bold font-heading">$1,240.00</div>
          <div className="text-slate-500 text-xs mt-1">Last reconciled 2 hrs ago</div>
        </div>
      </div>

      <div className="flex-1 bg-slate-900 border border-white/5 rounded-lg overflow-hidden flex flex-col">
        <div className="border-b border-white/5 p-3 text-sm font-medium text-white font-heading">Recent Orders</div>
        <div className="flex-1 overflow-hidden p-3 space-y-2">
          {[
            { id: "ORD-089", items: "2x Flat White, 1x Croissant", time: "2 min ago", amount: "$14.50", status: "Completed" },
            { id: "ORD-088", items: "1x Smashed Avo, 1x Long Black", time: "5 min ago", amount: "$22.00", status: "Preparing" },
            { id: "ORD-087", items: "3x Eggs Benny, 3x Lattes", time: "12 min ago", amount: "$68.50", status: "Completed" },
          ].map((order, i) => (
            <div key={i} className="flex items-center justify-between p-2 rounded hover:bg-white/5 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-slate-800 flex items-center justify-center text-xs text-slate-400 font-mono">
                  {order.id.split("-")[1]}
                </div>
                <div>
                  <div className="text-sm text-slate-200 font-medium">{order.items}</div>
                  <div className="text-xs text-slate-500">{order.time}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-white font-medium">{order.amount}</div>
                <div className={`text-xs ${order.status === 'Completed' ? 'text-green-400' : 'text-orange-400'}`}>{order.status}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

const Hero = () => {
  return (
    <section id="hero" className="relative pt-32 pb-20 md:pt-40 md:pb-32 overflow-hidden" style={{ background: "linear-gradient(160deg, #0d1b35 0%, #0a1628 50%, #0e1e3a 100%)" }}>
      {/* Background elements */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-blue-600/30 blur-[130px] rounded-full pointer-events-none"></div>
      
      <div className="container mx-auto px-4 md:px-6 relative z-10 text-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium"
        >
          <span className="flex h-2 w-2 rounded-full bg-blue-500"></span>
          Now live — built for Australian business
        </motion.div>
        
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-4xl md:text-6xl lg:text-7xl font-extrabold text-white tracking-tight mb-6 font-heading max-w-4xl mx-auto"
        >
          Run your business <span className="text-blue-500">smarter</span>, faster, together.
        </motion.h1>
        
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-lg md:text-xl text-slate-400 mb-10 max-w-2xl mx-auto"
        >
          Orders, payroll, cash management, staff scheduling, and AI-powered insights — all in one platform designed for modern business.
        </motion.p>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8"
        >
          <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto text-base h-12 px-8">
            <a href={APP_URL} data-testid="btn-hero-primary">Try free for 2 weeks <ArrowRight className="ml-2 w-4 h-4" /></a>
          </Button>
          <Button asChild variant="outline" size="lg" className="border-white/20 text-white hover:bg-white/10 w-full sm:w-auto text-base h-12 px-8 bg-transparent">
            <a href="#how-it-works" data-testid="btn-hero-secondary">See how it works</a>
          </Button>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-400 mb-16"
        >
          <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-blue-500" /> 2 weeks free — no credit card</span>
          <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-blue-500" /> Set up in under 10 minutes</span>
          <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-blue-500" /> AUD & multi-currency</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.5 }}
          className="relative z-20"
        >
          <DashboardMockup />
        </motion.div>
      </div>
    </section>
  );
};

const Integrations = () => {
  const logos = ["Xero", "Stripe", "Square", "Tyro", "Lightspeed", "Google Workspace"];
  return (
    <section className="py-10 border-b border-slate-200 bg-white">
      <div className="container mx-auto px-4 md:px-6">
        <p className="text-center text-sm font-semibold text-slate-500 mb-6 uppercase tracking-wider">Seamlessly integrates with your existing tools</p>
        <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 opacity-60 grayscale">
          {logos.map((logo, i) => (
            <span key={i} className="text-xl md:text-2xl font-bold font-heading text-slate-800">{logo}</span>
          ))}
        </div>
      </div>
    </section>
  );
};

const Features = () => {
  const features = [
    { icon: <Utensils className="w-6 h-6" />, title: "Smart Orders", desc: "Dine-in, takeaway, delivery. Split bills, discounts, refunds—handled gracefully." },
    { icon: <Coins className="w-6 h-6" />, title: "Cash Management", desc: "Denomination-based till tracking. Open/close business days with full audit trails." },
    { icon: <Users className="w-6 h-6" />, title: "Staff & Payroll", desc: "Payroll engine with roster integration, weekday/weekend rates, Xero sync. Advance tracking." },
    { icon: <Calendar className="w-6 h-6" />, title: "Roster & Scheduling", desc: "Build rosters, assign shifts, clock in/out. Actual hours sync to payroll automatically." },
    { icon: <Sparkles className="w-6 h-6" />, title: "AI Assistant", desc: "Ask anything about your business in plain English. Powered by Claude." },
    { icon: <BarChart className="w-6 h-6" />, title: "Reports & Analytics", desc: "Real-time dashboards, expense breakdowns, payroll summaries, end-of-day reports." },
    { icon: <FileSpreadsheet className="w-6 h-6" />, title: "Xero Integration", desc: "Push payroll and expense records directly to Xero. No manual entry required." },
    { icon: <Globe className="w-6 h-6" />, title: "Multi-Currency", desc: "Native AUD support. Correct denominations, currency formatting, and payroll flows." },
  ];

  return (
    <section id="features" className="py-24 bg-slate-50">
      <div className="container mx-auto px-4 md:px-6">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4 font-heading">Everything you need, nothing you don't</h2>
          <p className="text-lg text-slate-600">Built for speed and precision. Every feature reflects real-world operational pain, designed to save you hours every week.</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((f, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow"
            >
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 mb-4">
                {f.icon}
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2 font-heading">{f.title}</h3>
              <p className="text-slate-600 text-sm leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

const HowItWorks = () => {
  const steps = [
    { icon: <Settings />, title: "Set up your business", desc: "Add your menu, staff, and pay rates. Our guided setup gets you ready to trade in under 10 minutes." },
    { icon: <Play />, title: "Run your shifts", desc: "Take orders, manage cash drawers, and clock staff in/out. Everything updates live across the platform." },
    { icon: <CheckCircle />, title: "Close & get paid", desc: "Reconcile the till in minutes, run payroll with a click, and push everything to Xero automatically." },
  ];

  return (
    <section id="how-it-works" className="py-24 bg-white">
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex flex-col lg:flex-row items-center gap-16">
          <div className="lg:w-1/2">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6 font-heading">From open to close, simplified.</h2>
            <p className="text-lg text-slate-600 mb-10">We mapped out the exact workflow of a busy hospitality venue and removed all the friction. Here's how a typical day looks with KangPOS.</p>
            
            <div className="space-y-8">
              {steps.map((step, i) => (
                <div key={i} className="flex gap-4 relative">
                  {i !== steps.length - 1 && <div className="absolute top-12 left-6 w-px h-12 bg-slate-200"></div>}
                  <div className="w-12 h-12 bg-slate-950 rounded-full flex items-center justify-center text-white shrink-0 shadow-md z-10">
                    {step.icon}
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-slate-900 mb-2 font-heading">{step.title}</h3>
                    <p className="text-slate-600">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="lg:w-1/2 w-full">
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 shadow-sm">
              <div className="space-y-4">
                {/* Mock timeline items */}
                <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    <span className="font-medium text-slate-900">Till Opened</span>
                  </div>
                  <span className="text-sm text-slate-500 font-mono">06:30 AM</span>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="font-medium text-slate-900">Morning Rush Peak</span>
                  </div>
                  <span className="text-sm text-slate-500 font-mono">08:45 AM</span>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                    <span className="font-medium text-slate-900">Staff Changeover</span>
                  </div>
                  <span className="text-sm text-slate-500 font-mono">02:00 PM</span>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-slate-800"></div>
                    <span className="font-medium text-slate-900">Till Reconciled & Closed</span>
                  </div>
                  <span className="text-sm text-slate-500 font-mono">04:30 PM</span>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    <span className="font-medium text-slate-900">Payroll Synced to Xero</span>
                  </div>
                  <span className="text-sm text-slate-500 font-mono">04:35 PM</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const About = () => {
  return (
    <section id="about" className="py-24 bg-slate-950 text-white relative overflow-hidden">
      <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-blue-600/10 blur-[100px] rounded-full pointer-events-none"></div>
      
      <div className="container mx-auto px-4 md:px-6 relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold mb-6 font-heading">Built by operators, for operators.</h2>
            <p className="text-slate-300 text-lg mb-6 leading-relaxed">
              KangPOS was built because we couldn't find a POS that understood how a busy business actually operates. Big players are bloated and expensive. Cheap ones cut corners on payroll, cash management, and reporting.
            </p>
            <p className="text-slate-300 text-lg mb-10 leading-relaxed">
              Based right here in Adelaide, we built the tool we wanted to use. Precision over bloat. Speed over complexity.
            </p>
            
            <div className="grid sm:grid-cols-2 gap-6">
              <div className="bg-white/5 border border-white/10 p-4 rounded-xl">
                <Clock className="w-6 h-6 text-blue-400 mb-3" />
                <h4 className="font-bold font-heading mb-1">Speed over complexity</h4>
                <p className="text-sm text-slate-400">Every flow is optimised for the busy rush.</p>
              </div>
              <div className="bg-white/5 border border-white/10 p-4 rounded-xl">
                <Shield className="w-6 h-6 text-blue-400 mb-3" />
                <h4 className="font-bold font-heading mb-1">Your data, your business</h4>
                <p className="text-sm text-slate-400">Audit trails, role-based access, no lock-in.</p>
              </div>
              <div className="bg-white/5 border border-white/10 p-4 rounded-xl sm:col-span-2">
                <Heart className="w-6 h-6 text-blue-400 mb-3" />
                <h4 className="font-bold font-heading mb-1">Support that answers</h4>
                <p className="text-sm text-slate-400">Real humans, fast responses, Adelaide-based.</p>
              </div>
            </div>
          </div>
          
          <div className="space-y-6">
            <div className="bg-blue-600 rounded-2xl p-8 md:p-10 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-6 opacity-20">
                <Logo />
              </div>
              <h3 className="text-2xl font-bold font-heading mb-6 relative z-10">"I actually trust the numbers now."</h3>
              <p className="text-blue-50 text-lg mb-8 relative z-10 italic">
                "We used to spend an hour every close reconciling cash and working out what to pay staff. Now it's ten minutes and I actually trust the numbers. It's transformed how we run the floor."
              </p>
              <div className="flex items-center gap-4 relative z-10">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center font-bold">BO</div>
                <div>
                  <div className="font-bold font-heading">Business Owner</div>
                  <div className="text-sm text-blue-200">Adelaide, SA</div>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="text-2xl font-bold font-heading text-blue-400">99.9%</div>
                <div className="text-xs text-slate-400 mt-1 uppercase tracking-wider">Uptime SLA</div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="text-2xl font-bold font-heading text-blue-400">&lt;2 hr</div>
                <div className="text-xs text-slate-400 mt-1 uppercase tracking-wider">Avg Support</div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="text-2xl font-bold font-heading text-blue-400">2025</div>
                <div className="text-xs text-slate-400 mt-1 uppercase tracking-wider">Founded in SA</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const Pricing = () => {
  return (
    <section id="pricing" className="py-24 bg-slate-50">
      <div className="container mx-auto px-4 md:px-6">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4 font-heading">Simple, transparent pricing</h2>
          <p className="text-lg text-slate-600">No complex tiers. No hidden fees. Just everything you need to run your business.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* Main Plan */}
          <div className="bg-white rounded-3xl shadow-xl border border-blue-100 p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-blue-600 text-white text-xs font-bold px-4 py-1 rounded-bl-lg uppercase tracking-wider">Most Popular</div>
            
            <h3 className="text-2xl font-bold text-slate-900 font-heading">Standard</h3>
            <div className="mt-4 mb-6">
              <span className="text-5xl font-extrabold text-slate-900 font-heading">$29</span>
              <span className="text-slate-500 font-medium"> / week</span>
            </div>
            <p className="text-slate-600 mb-8">Everything included. No per-user or per-device limits.</p>
            
            <Button asChild size="lg" className="w-full bg-blue-600 hover:bg-blue-700 text-white mb-8 h-12">
              <a href={APP_URL} data-testid="btn-pricing-standard">Start free for 2 weeks &rarr;</a>
            </Button>
            
            <ul className="space-y-4">
              {[
                "Unlimited orders & cash management",
                "Full staff, roster & payroll engine",
                "Advance tracking & repayment plans",
                "Xero integration",
                "AI assistant (Claude)",
                "Real-time reports & analytics",
                "Unlimited staff members",
                "Adelaide-based support"
              ].map((feature, i) => (
                <li key={i} className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                  <span className="text-slate-700">{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Enterprise Plan */}
          <div className="bg-slate-900 rounded-3xl shadow-xl border border-slate-800 p-8 text-white flex flex-col">
            <h3 className="text-2xl font-bold font-heading">Enterprise</h3>
            <div className="mt-4 mb-6">
              <span className="text-4xl font-bold font-heading">Custom pricing</span>
            </div>
            <p className="text-slate-400 mb-8">For multi-site operators and franchises needing dedicated support and custom flows.</p>
            
            <Button asChild size="lg" variant="outline" className="w-full border-slate-700 text-white hover:bg-slate-800 hover:text-white mb-8 h-12 bg-transparent">
              <a href="#contact" data-testid="btn-pricing-enterprise">Contact Sales</a>
            </Button>
            
            <ul className="space-y-4 flex-1">
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                <span className="text-slate-300 font-medium">Everything in Standard, plus:</span>
              </li>
              {[
                "Unlimited locations & regional data",
                "Dedicated account manager",
                "Custom integrations & SLA",
                "White-label options",
                "Priority on-site support (SA)"
              ].map((feature, i) => (
                <li key={i} className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-slate-600 shrink-0 mt-0.5" />
                  <span className="text-slate-300">{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
};

const Contact = () => {
  const [formData, setFormData] = useState({
    name: "", email: "", business: "", topic: "", message: ""
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const subject = encodeURIComponent(`KangPOS Inquiry: ${formData.topic || 'General'}`);
    const body = encodeURIComponent(`Name: ${formData.name}\nEmail: ${formData.email}\nBusiness: ${formData.business}\n\nMessage:\n${formData.message}`);
    window.location.href = `mailto:pahulpreet2959@gmail.com?subject=${subject}&body=${body}`;
  };

  return (
    <section id="contact" className="py-24 bg-white">
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid lg:grid-cols-2 gap-16 max-w-6xl mx-auto">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6 font-heading">Let's talk business.</h2>
            <p className="text-lg text-slate-600 mb-10">Have questions about pricing, features, or how KangPOS can work for your specific venue? We're here to help.</p>
            
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 shrink-0">
                  <Mail className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-slate-900 font-heading">Email us</h4>
                  <a href="mailto:pahulpreet2959@gmail.com" className="text-blue-600 hover:underline">pahulpreet2959@gmail.com</a>
                </div>
              </div>
              
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 shrink-0">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-slate-900 font-heading">Live Chat</h4>
                  <p className="text-slate-600">Available inside the KangPOS app dashboard.</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 shrink-0">
                  <MapPin className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-slate-900 font-heading">Headquarters</h4>
                  <p className="text-slate-600">Adelaide, South Australia (ACST)</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-50 p-8 rounded-3xl border border-slate-200 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input 
                    id="name" 
                    required 
                    placeholder="John Doe" 
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    className="bg-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    required 
                    placeholder="john@example.com"
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                    className="bg-white"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="business">Business Name</Label>
                <Input 
                  id="business" 
                  required 
                  placeholder="The Corner Cafe"
                  value={formData.business}
                  onChange={e => setFormData({...formData, business: e.target.value})}
                  className="bg-white"
                />
              </div>

              <div className="space-y-2">
                <Label>Topic</Label>
                <Select value={formData.topic} onValueChange={val => setFormData({...formData, topic: val})}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Select a topic" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Book a demo">Book a demo</SelectItem>
                    <SelectItem value="Pricing question">Pricing question</SelectItem>
                    <SelectItem value="Feature question">Feature question</SelectItem>
                    <SelectItem value="Enterprise/multi-site">Enterprise / multi-site</SelectItem>
                    <SelectItem value="Technical support">Technical support</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Message</Label>
                <Textarea 
                  id="message" 
                  required 
                  rows={4} 
                  placeholder="How can we help?"
                  value={formData.message}
                  onChange={e => setFormData({...formData, message: e.target.value})}
                  className="bg-white resize-none"
                />
              </div>

              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white h-11 text-base">
                Send Message
              </Button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
};

const Footer = () => {
  return (
    <footer className="bg-slate-950 text-slate-400 py-12 border-t border-white/10">
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 mb-12">
          <div className="col-span-2 lg:col-span-2">
            <Logo />
            <p className="mt-4 text-sm max-w-xs">
              Run your business smarter, faster, together. The all-in-one POS built by operators, for operators.
            </p>
          </div>
          
          <div>
            <h4 className="text-white font-semibold mb-4 font-heading">Product</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
              <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
              <li><a href="#how-it-works" className="hover:text-white transition-colors">How it works</a></li>
              <li><a href={APP_URL} className="hover:text-white transition-colors text-blue-400">Login</a></li>
            </ul>
          </div>
          
          <div>
            <h4 className="text-white font-semibold mb-4 font-heading">Company</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#about" className="hover:text-white transition-colors">About us</a></li>
              <li><a href="#contact" className="hover:text-white transition-colors">Contact</a></li>
              <li><a href="mailto:pahulpreet2959@gmail.com" className="hover:text-white transition-colors">Email</a></li>
            </ul>
          </div>
          
          <div>
            <h4 className="text-white font-semibold mb-4 font-heading">Legal</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Cookie Policy</a></li>
            </ul>
          </div>
        </div>
        
        <div className="pt-8 border-t border-white/10 text-sm flex flex-col md:flex-row items-center justify-between gap-4">
          <p>&copy; 2025–2026 KangPOS. All rights reserved.</p>
          <p>Adelaide, South Australia</p>
        </div>
      </div>
    </footer>
  );
};

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950 font-sans selection:bg-blue-500/30 selection:text-blue-200">
      <Navbar />
      <Hero />
      <Integrations />
      <Features />
      <HowItWorks />
      <About />
      <Pricing />
      <Contact />
      <Footer />
    </div>
  );
}