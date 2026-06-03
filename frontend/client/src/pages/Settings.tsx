import { Sidebar } from "@/components/Sidebar";
import {
  useSettings,
  useUpdateSettings,
  useCommunicationSettings,
  useUpdateCommunicationSettings,
  useBankAccount,
  useUpsertBankAccount,
} from "@/hooks/use-settings";
import { usePartners } from "@/hooks/use-partners.ts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { PartnerManager } from "./PartnerManager";
import { useXeroStatus, useXeroConnect, useXeroDisconnect } from "@/hooks/use-xero";
import { useTheme } from "@/hooks/use-theme";
import { useState, useEffect } from "react";
import {
  Sun,
  Moon,
  Monitor,
  Settings2,
  Bell,
  Building2,
  Zap,
  Wifi,
  WifiOff,
  DollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("bg-card rounded-2xl border shadow-sm overflow-hidden", className)}>
      <div className="px-6 py-4 border-b bg-muted/30 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h2 className="font-semibold text-sm text-foreground">{title}</h2>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b last:border-0">
      <div className="pr-4">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export default function Settings() {
  const { data: settings } = useSettings();
  const { mutate: updateSettings } = useUpdateSettings();
  const { theme, setTheme } = useTheme();

  usePartners();
  const { data: comm } = useCommunicationSettings();
  const { mutate: updateComm } = useUpdateCommunicationSettings();

  const [form, setForm] = useState<any>({
    use_business_day: false,
    enable_cash_recount: false,
    allow_staff_print: false,
    enable_vendor_ledger: false,
    enable_customer_ledger: false,
    enable_email: false,
    enable_partners: false,
    use_payroll: false,
    payid: "",
    payid_name: "",
    eftpos_provider: "" as string,
    eftpos_api_key: "",
    eftpos_merchant_id: "",
    eftpos_terminal_id: "",
  });

  const [commForm, setCommForm] = useState<any>({
    send_bill_email: false,
    notify_owner_email: false,
    owner_email: "",
  });

  const { data: bank } = useBankAccount();
  const { mutate: saveBank } = useUpsertBankAccount();
  const [bankForm, setBankForm] = useState<any>({});

  const { data: xeroStatus } = useXeroStatus();
  const { mutate: xeroConnect, isPending: connectingXero } = useXeroConnect();
  const { mutate: xeroDisconnect, isPending: disconnectingXero } = useXeroDisconnect();

  useEffect(() => { if (bank) setBankForm(bank); }, [bank]);
  useEffect(() => { if (settings) setForm(settings); }, [settings]);
  useEffect(() => { if (comm) setCommForm(comm); }, [comm]);

  return (
    <div className="flex bg-background min-h-screen pt-16 lg:pt-8">
      <Sidebar />

      <main className="flex-1 p-4 sm:p-6 lg:p-8 lg:ml-60 w-full">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your business configuration</p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

          {/* ── APPEARANCE ── */}
          <SectionCard icon={Monitor} title="Appearance" description="Customise how KangPOS looks">
            <SettingRow label="Theme" description="Choose between light and dark interface">
              <div className="flex items-center gap-1 p-1 bg-muted rounded-xl">
                <button
                  onClick={() => setTheme("light")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                    theme === "light"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Sun className="w-3.5 h-3.5" />
                  Light
                </button>
                <button
                  onClick={() => setTheme("dark")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                    theme === "dark"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Moon className="w-3.5 h-3.5" />
                  Dark
                </button>
              </div>
            </SettingRow>
          </SectionCard>

          {/* ── SYSTEM ── */}
          <SectionCard icon={Settings2} title="System" description="Core operational settings">
            <div className="space-y-0">
              <SettingRow
                label="Business Day Mode"
                description="Sales and cash tracking tied to an open/close business day"
              >
                <Switch
                  checked={!!form.use_business_day}
                  onCheckedChange={(v) => setForm({ ...form, use_business_day: v })}
                />
              </SettingRow>

              <SettingRow
                label="Cash Recount"
                description="Prompt for cash drawer recount at end-of-day"
              >
                <Switch
                  checked={!!form.enable_cash_recount}
                  onCheckedChange={(v) => setForm({ ...form, enable_cash_recount: v })}
                />
              </SettingRow>

              <SettingRow
                label="Staff Printing"
                description="Allow staff (non-admin) to print receipts"
              >
                <Switch
                  checked={!!form.allow_staff_print}
                  onCheckedChange={(v) => setForm({ ...form, allow_staff_print: v })}
                />
              </SettingRow>

              <SettingRow
                label="Enable Partners"
                description="Track and manage business partners' revenue share"
              >
                <Switch
                  checked={!!form.enable_partners}
                  onCheckedChange={(v) => setForm({ ...form, enable_partners: v })}
                />
              </SettingRow>

              <SettingRow
                label="Payroll"
                description="Shift-based payroll with Xero integration"
              >
                <Switch
                  checked={!!form.use_payroll}
                  onCheckedChange={(v) => setForm({ ...form, use_payroll: v })}
                />
              </SettingRow>
            </div>

            <Button className="mt-5 w-full sm:w-auto" onClick={() => updateSettings(form)}>
              Save System Settings
            </Button>
          </SectionCard>

          {/* ── PARTNERS (full width if enabled) ── */}
          {settings?.enable_partners && (
            <SectionCard
              icon={Settings2}
              title="Partners"
              description="Manage business partners and revenue share"
              className="xl:col-span-2"
            >
              <PartnerManager />
            </SectionCard>
          )}

          {/* ── PAYMENT ── */}
          <SectionCard
            icon={DollarSign}
            title="Payment"
            description="PayID and EFTPOS terminal settings"
          >
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              PayID Details
            </p>
            <div className="space-y-3">
              <Input
                placeholder="PayID (e.g. 0400 000 000)"
                value={form.payid || ""}
                onChange={(e) => setForm({ ...form, payid: e.target.value })}
              />
              <Input
                placeholder="PayID Name"
                value={form.payid_name || ""}
                onChange={(e) => setForm({ ...form, payid_name: e.target.value })}
              />
            </div>

            <div className="mt-6 pt-5 border-t space-y-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                EFTPOS Terminal
              </p>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Provider</label>
                <select
                  className="border rounded-lg px-3 py-2 w-full text-sm bg-background text-foreground focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition"
                  value={form.eftpos_provider ?? settings?.eftpos_provider ?? ""}
                  onChange={(e) => setForm({ ...form, eftpos_provider: e.target.value })}
                >
                  <option value="">None (manual confirmation)</option>
                  <option value="tyro">Tyro</option>
                  <option value="linkly">Linkly (PC-EFTPOS)</option>
                </select>
              </div>

              {(form.eftpos_provider || settings?.eftpos_provider) && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">API Key / Bearer Token</label>
                    <input
                      type="password"
                      className="border rounded-lg px-3 py-2 w-full text-sm bg-background text-foreground focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition"
                      placeholder="Paste your API key"
                      value={form.eftpos_api_key ?? settings?.eftpos_api_key ?? ""}
                      onChange={(e) => setForm({ ...form, eftpos_api_key: e.target.value })}
                    />
                  </div>

                  {(form.eftpos_provider ?? settings?.eftpos_provider) === "tyro" && (
                    <div>
                      <label className="text-xs text-muted-foreground mb-1.5 block">Merchant ID</label>
                      <input
                        className="border rounded-lg px-3 py-2 w-full text-sm bg-background text-foreground focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition"
                        placeholder="Tyro Merchant ID"
                        value={form.eftpos_merchant_id ?? settings?.eftpos_merchant_id ?? ""}
                        onChange={(e) => setForm({ ...form, eftpos_merchant_id: e.target.value })}
                      />
                    </div>
                  )}

                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Terminal ID (TID)</label>
                    <input
                      className="border rounded-lg px-3 py-2 w-full text-sm bg-background text-foreground focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition"
                      placeholder="Terminal serial / TID"
                      value={form.eftpos_terminal_id ?? settings?.eftpos_terminal_id ?? ""}
                      onChange={(e) => setForm({ ...form, eftpos_terminal_id: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </div>

            <Button className="mt-5 w-full sm:w-auto" onClick={() => updateSettings(form)}>
              Save Payment Settings
            </Button>
          </SectionCard>

          {/* ── COMMUNICATION ── */}
          <SectionCard
            icon={Bell}
            title="Communication"
            description="Configure how bills and alerts are sent"
          >
            <div className="space-y-0">
              <SettingRow
                label="Send Bill via Email"
                description="Automatically email the customer receipt"
              >
                <Switch
                  checked={!!commForm.send_bill_email}
                  onCheckedChange={(v) => setCommForm({ ...commForm, send_bill_email: v })}
                />
              </SettingRow>
            </div>

            <div className="mt-5 space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Owner Email (for alerts)</label>
                <Input
                  placeholder="owner@business.com"
                  value={commForm.owner_email || ""}
                  onChange={(e) => setCommForm({ ...commForm, owner_email: e.target.value })}
                />
              </div>
            </div>

            <Button className="mt-5 w-full sm:w-auto" onClick={() => updateComm(commForm)}>
              Save Communication Settings
            </Button>
          </SectionCard>

          {/* ── BANK ACCOUNT ── */}
          <SectionCard
            icon={Building2}
            title="Bank Account"
            description="Business bank account for reports and payroll"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="text-xs text-muted-foreground mb-1.5 block">Bank Name</label>
                <Input
                  placeholder="e.g. Commonwealth Bank"
                  value={bankForm.bank_name || ""}
                  onChange={(e) => setBankForm({ ...bankForm, bank_name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Account Number</label>
                <Input
                  placeholder="Account number"
                  value={bankForm.account_number || ""}
                  onChange={(e) => setBankForm({ ...bankForm, account_number: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">BSB</label>
                <Input
                  placeholder="e.g. 062-000"
                  value={bankForm.ifsc || ""}
                  onChange={(e) => setBankForm({ ...bankForm, ifsc: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Account Holder</label>
                <Input
                  placeholder="Full legal name"
                  value={bankForm.account_holder || ""}
                  onChange={(e) => setBankForm({ ...bankForm, account_holder: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Opening Balance</label>
                {bank ? (
                  <Input value="Locked after first save" disabled className="opacity-60" />
                ) : (
                  <Input
                    placeholder="0.00"
                    value={bankForm.opening_balance || ""}
                    onChange={(e) => setBankForm({ ...bankForm, opening_balance: e.target.value })}
                  />
                )}
              </div>
            </div>

            <Button className="mt-5 w-full sm:w-auto" onClick={() => saveBank(bankForm)}>
              Save Bank Account
            </Button>
          </SectionCard>

          {/* ── XERO ── */}
          {form.use_payroll && (
            <SectionCard
              icon={Zap}
              title="Xero Integration"
              description="Connect Xero to send payroll timesheets automatically"
            >
              {xeroStatus?.connected ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800">
                    <Wifi className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <div>
                      <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
                        Connected — {xeroStatus.tenant_name}
                      </p>
                      {xeroStatus.connected_at && (
                        <p className="text-xs text-emerald-600/70 dark:text-emerald-500 mt-0.5">
                          Since {new Date(xeroStatus.connected_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={disconnectingXero}
                    onClick={() => xeroDisconnect()}
                  >
                    {disconnectingXero ? "Disconnecting…" : "Disconnect Xero"}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl border">
                    <WifiOff className="w-4 h-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Not connected to Xero</p>
                  </div>
                  <div>
                    <Button disabled={connectingXero} onClick={() => xeroConnect()}>
                      {connectingXero ? "Redirecting…" : "Connect to Xero"}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-2">
                      You'll be redirected to Xero to authorise access, then brought back here.
                    </p>
                  </div>
                </div>
              )}
            </SectionCard>
          )}

        </div>
        <div className="h-12" />
      </main>
    </div>
  );
}
