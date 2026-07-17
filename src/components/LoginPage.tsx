/**
 * PIN Login screen — matches the app's existing visual design
 * (navy sidebar color as accent, white card, large readable inputs).
 * Drop this in as your app's entry point when there's no active session.
 */

import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";

export default function LoginPage() {
  const { loginWithPin } = useAuth();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error } = await loginWithPin(pin);
    setSubmitting(false);
    if (error) {
      setError(error);
      setPin("");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F6FA]">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-lg shadow-md p-10 w-full max-w-sm border border-gray-100"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-lg bg-[#0B2A55] flex items-center justify-center mb-3">
            <span className="text-white font-bold text-xl">◆</span>
          </div>
          <h1 className="text-lg font-bold text-[#0B2A55] tracking-wide">SAHIL ROAD LINES</h1>
          <p className="text-xs text-gray-500 tracking-widest">TRANSPORT ERP</p>
        </div>

        <label className="block text-sm font-medium text-gray-700 mb-2">
          Enter your PIN
        </label>
        <input
          type="password"
          inputMode="numeric"
          maxLength={6}
          autoFocus
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          className="w-full text-center tracking-[0.5em] text-2xl border border-gray-300 rounded-md py-3 mb-4 focus:outline-none focus:ring-2 focus:ring-[#0B2A55]"
          placeholder="••••••"
        />

        {error && <p className="text-red-600 text-sm mb-4 text-center">{error}</p>}

        <button
          type="submit"
          disabled={submitting || pin.length !== 6}
          className="w-full bg-[#0B2A55] text-white rounded-md py-3 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Checking..." : "Login"}
        </button>
      </form>
    </div>
  );
}