import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/AuthContext";
import { useCompanyLogo } from "@/lib/useCompanyLogo";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const logoUrl = useCompanyLogo();
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error } = await login(email.trim(), pin);
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
          {logoUrl ? (
            <img src={logoUrl} alt="Sahil Road Lines logo" className="mb-3 h-20 w-20 rounded-lg object-contain" />
          ) : (
            <div className="w-20 h-20 rounded-lg bg-[#0B2A55] flex items-center justify-center mb-3">
              <span className="text-white font-bold text-2xl">SRL</span>
            </div>
          )}
          <h1 className="text-lg font-bold text-[#0B2A55] tracking-wide">SAHIL ROAD LINES</h1>
          <p className="text-xs text-gray-500 tracking-widest">TRANSPORT ERP</p>
        </div>

        <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
        <input
          type="text"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-gray-300 rounded-md py-3 px-3 mb-4 focus:outline-none focus:ring-2 focus:ring-[#0B2A55]"
          placeholder="you@sahilroadlines.local"
          autoComplete="username"
        />

        <label className="block text-sm font-medium text-gray-700 mb-2">Enter your PIN</label>
        <div className="relative mb-1">
          <input
            type={showPin ? "text" : "password"}
            inputMode="numeric"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            className="w-full text-center tracking-[0.5em] text-2xl border border-gray-300 rounded-md py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-[#0B2A55]"
            placeholder="••••••"
            autoComplete="current-password"
          />
          <button
            type="button"
            onClick={() => setShowPin((s) => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            aria-label={showPin ? "Hide PIN" : "Show PIN"}
            tabIndex={-1}
          >
            {showPin ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>

        <div className="text-right mb-4">
          <button
            type="button"
            onClick={() => navigate({ to: "/forgot-pin" })}
            className="text-xs text-[#0B2A55] hover:underline"
          >
            Forgot PIN?
          </button>
        </div>

        {error && <p className="text-red-600 text-sm mb-4 text-center">{error}</p>}

        <button
          type="submit"
          disabled={submitting || pin.length !== 6 || !email.trim()}
          className="w-full bg-[#0B2A55] text-white rounded-md py-3 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Checking..." : "Login"}
        </button>
      </form>
    </div>
  );
}