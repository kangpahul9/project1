import { useState } from "react";
import { useLogin } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { Delete, Loader2, LockKeyhole } from "lucide-react";

export default function Login() {
  const [pin, setPin] = useState("");
  const { mutate: login, isPending } = useLogin();

  const handleNumClick = (num: string) => {
    if (pin.length < 4) {
      const newPin = pin + num;
      setPin(newPin);
      if (newPin.length === 4) {
        login({ pin: newPin });
        setPin(""); // Clear for UX or failed attempts
      }
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
            <LockKeyhole className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold font-display text-gray-900">Welcome Back</h1>
          <p className="text-gray-500 mt-2">Enter your PIN to access the terminal</p>
        </div>

        <Card className="border-0 shadow-xl overflow-hidden">
          <CardContent className="p-8">
            <div className="flex justify-center gap-4 mb-8">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`w-4 h-4 rounded-full transition-all duration-300 ${
                    i < pin.length ? "bg-primary scale-110" : "bg-gray-200"
                  }`}
                />
              ))}
            </div>

            <div className="grid grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <Button
                  key={num}
                  variant="outline"
                  className="h-16 text-2xl font-medium rounded-xl hover:bg-primary/5 hover:border-primary/50 hover:text-primary transition-all active:scale-95"
                  onClick={() => handleNumClick(num.toString())}
                  disabled={isPending}
                >
                  {num}
                </Button>
              ))}
              <div className="col-span-1" />
              <Button
                variant="outline"
                className="h-16 text-2xl font-medium rounded-xl hover:bg-primary/5 hover:border-primary/50 hover:text-primary transition-all active:scale-95"
                onClick={() => handleNumClick("0")}
                disabled={isPending}
              >
                0
              </Button>
              <Button
                variant="ghost"
                className="h-16 rounded-xl hover:bg-destructive/10 hover:text-destructive transition-all active:scale-95"
                onClick={handleBackspace}
                disabled={isPending}
              >
                {isPending ? <Loader2 className="animate-spin" /> : <Delete className="w-6 h-6" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
