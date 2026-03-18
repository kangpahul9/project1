import { Sidebar } from "@/components/Sidebar";
import {
  useSettings,
  useUpdateSettings,
  useCommunicationSettings,
  useUpdateCommunicationSettings,useBankAccount,useUpsertBankAccount
} from "@/hooks/use-settings";
import {useCreatePartner, useDeletePartner, usePartners, useUpdatePartner} from "@/hooks/use-partners.ts"
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PartnerManager } from "./PartnerManager";
import { useCreateCheckout, useSubscription } from "@/hooks/use-billing";

import { useState, useEffect } from "react";

export default function Settings() {

  const { data: settings } = useSettings();
  const { mutate: updateSettings } = useUpdateSettings();

  const { data: partners } = usePartners();
  const { data, isLoading } = useSubscription();

  const { data: comm } = useCommunicationSettings();
  const { mutate: updateComm } = useUpdateCommunicationSettings();
  const [partnerId, setPartnerId] = useState<number | null>(null);

  const [form, setForm] = useState<any>({});
  const [commForm, setCommForm] = useState<any>({});
  const { data: bank } = useBankAccount();
const { mutate: saveBank } = useUpsertBankAccount();
const [bankForm, setBankForm] = useState<any>({});
const { mutate: createCheckout, isPending } = useCreateCheckout();


useEffect(() => {
  if (bank) setBankForm(bank);
}, [bank]);

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  useEffect(() => {
    if (comm) setCommForm(comm);
  }, [comm]);


  return (
    <div className="flex bg-gray-50 min-h-screen">

      <Sidebar />

      <main className="flex-1 ml-64 p-8">

        <h1 className="text-3xl font-bold mb-6">Settings</h1>

{isLoading ? (
  <p className="text-sm text-gray-500">Checking subscription...</p>
) : data?.subscription_status === "active" ? (
  <div className="p-4 rounded-xl bg-green-50 border border-green-200">
    <p className="text-green-700 font-semibold">
      KangPOS Pro Active ✅
    </p>
    <p className="text-sm text-green-600 mt-1">
      Valid till:{" "}
      {data.subscription_valid_till
        ? new Date(data.subscription_valid_till).toLocaleDateString()
        : "N/A"}
    </p>
    <p className="text-xs text-gray-500 mt-2">
      To cancel, contact: +61 434 947 020
    </p>
  </div>
) : (
  <div className="p-4 rounded-xl bg-red-50 border border-red-200">
    <p className="text-red-700 font-semibold">
      Subscription expired ❌
    </p>
    <p className="text-sm text-red-600 mt-1">
      Please recharge to continue using KangPOS
    </p>

    <button
      onClick={() => createCheckout()}
      className="mt-3 px-4 py-2 bg-violet-600 text-white rounded-lg"
    >
      Recharge Now
    </button>
  </div>
)}

        {/* SYSTEM SETTINGS */}

        <div className="bg-white p-6 rounded-xl shadow mb-8">

          <h2 className="text-xl font-semibold mb-4">System</h2>

          <div className="space-y-3">

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.use_business_day}
                onChange={(e) =>
                  setForm({
                    ...form,
                    use_business_day: e.target.checked
                  })
                }
              />
              Use Business Day
            </label>


            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.enable_cash_recount}
                onChange={(e) =>
                  setForm({
                    ...form,
                    enable_cash_recount: e.target.checked
                  })
                }
              />
              Enable Cash Recount
            </label>


            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.allow_staff_print}
                onChange={(e) =>
                  setForm({
                    ...form,
                    allow_staff_print: e.target.checked
                  })
                }
              />
              Allow Staff Printing
            </label>

            <Input
  placeholder="UPI ID (e.g. yourname@upi)"
  value={form.upi_id || ""}
  onChange={(e) =>
    setForm({
      ...form,
      upi_id: e.target.value
    })
  }
/>


            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.enable_partners}
                onChange={(e) =>
                  setForm({
                    ...form,
                    enable_partners: e.target.checked
                  })
                }
              />
              Enable Partners
            </label>

            {settings?.enable_partners && (
   <PartnerManager />
)}

          </div>

          <Button
            className="mt-4"
            onClick={() => updateSettings(form)}
          >
            Save Settings
          </Button>

        </div>


        {/* COMMUNICATION SETTINGS */}
        
        <div className="bg-white p-6 rounded-xl shadow">

          <h2 className="text-xl font-semibold mb-4">Communication</h2>


          <div className="space-y-4">

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={commForm.send_bill_whatsapp}
                onChange={(e) =>
                  setCommForm({
                    ...commForm,
                    send_bill_whatsapp: e.target.checked
                  })
                }
              />
              Send Bill via WhatsApp
            </label>


            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={commForm.send_bill_email}
                onChange={(e) =>
                  setCommForm({
                    ...commForm,
                    send_bill_email: e.target.checked
                  })
                }
              />
              Send Bill via Email
            </label>


            <Input
              placeholder="Owner Phone"
              value={commForm.owner_phone || ""}
              onChange={(e) =>
                setCommForm({
                  ...commForm,
                  owner_phone: e.target.value
                })
              }
            />

            <Input
              placeholder="Owner Email"
              value={commForm.owner_email || ""}
              onChange={(e) =>
                setCommForm({
                  ...commForm,
                  owner_email: e.target.value
                })
              }
            />

          </div>


          <Button
            className="mt-4"
            onClick={() => updateComm(commForm)}
          >
            Save Communication Settings
          </Button>

        </div>
              <div className="bg-white p-6 rounded-xl shadow mt-8">
  <h2 className="text-xl font-semibold mb-4">Bank Account</h2>

  <div className="space-y-4">

    <Input
      placeholder="Bank Name"
      value={bankForm.bank_name || ""}
      onChange={(e) =>
        setBankForm({ ...bankForm, bank_name: e.target.value })
      }
    />

    <Input
      placeholder="Account Number"
      value={bankForm.account_number || ""}
      onChange={(e) =>
        setBankForm({ ...bankForm, account_number: e.target.value })
      }
    />

    <Input
      placeholder="IFSC / BSB"
      value={bankForm.ifsc || ""}
      onChange={(e) =>
        setBankForm({ ...bankForm, ifsc: e.target.value })
      }
    />

    <Input
      placeholder="Account Holder"
      value={bankForm.account_holder || ""}
      onChange={(e) =>
        setBankForm({ ...bankForm, account_holder: e.target.value })
      }
    />
    {bank ? (
  <Input value="Opening balance locked" disabled />
) : 
    <Input
  placeholder="Opening Balance"
  value={bankForm.opening_balance || ""}
  onChange={(e) =>
    setBankForm({ ...bankForm, opening_balance: e.target.value })
  }
/>
}

  </div>

  <Button
    className="mt-4"
    onClick={() => saveBank(bankForm)}
  >
    Save Bank Account
  </Button>
</div>
      </main>
    </div>
  );
}