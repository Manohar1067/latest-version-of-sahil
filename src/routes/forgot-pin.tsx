import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, KeyRound } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

export const Route = createFileRoute("/forgot-pin")({ component: ForgotPinPage });

function ForgotPinPage() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (sending) return;
    setError(null);

    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setError("Please enter a valid email address.");
      return;
    }

    setSending(true);
    try {
      const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;
      const redirectTo = `${appUrl}/reset-pin`;
      console.log("Forgot PIN — requesting recovery email for:", value, "redirectTo:", redirectTo);

      const { error: sendError } = await supabase.auth.resetPasswordForEmail(value, {
        redirectTo,
      });
      if (sendError) {
        // Log every detail for diagnosis — never hide the real error during dev.
        console.error("resetPasswordForEmail error:", {
          message: sendError.message,
          status: (sendError as any).status,
          code: (sendError as any).code,
          name: sendError.name,
          full: sendError,
        });

        const code = ((sendError as any).code || "").toLowerCase();
        const status = (sendError as any).status;
        const msg = (sendError.message || "").toLowerCase();

        const isRateLimit =
          status === 429 ||
          code.includes("rate_limit") ||
          code.includes("over_email_send_rate_limit") ||
          code.includes("over_request_rate_limit") ||
          /frequently|too many|rate limit|wait.*seconds|minute/i.test(msg);

        if (isRateLimit) {
          setError("We've sent several links recently. Please wait a few minutes before requesting another reset link.");
          return;
        }

        setError("Unable to send reset link. Please try again.");
        return;
      }
      setSent(true);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F6FA]">
      <div className="bg-white rounded-lg shadow-md p-10 w-full max-w-sm border border-gray-100">
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 rounded-lg bg-[#0B2A55] flex items-center justify-center mb-4">
            <KeyRound className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-lg font-bold text-[#0B2A55] tracking-wide">Forgot PIN</h1>
          <p className="text-xs text-gray-500 text-center mt-1">
            Enter your registered email address. We'll send you a secure link to reset your 6-digit PIN.
          </p>
        </div>

        {sent ? (
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-6">
              If an account exists with this email, a reset link has been sent. Please check your inbox and
              follow the link to set a new PIN.
            </p>
            <Link
              to="/"
              className="w-full inline-block text-center bg-[#0B2A55] text-white rounded-md py-3 font-medium hover:bg-[#0A2344]"
            >
              Back to Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-md py-3 px-3 mb-4 focus:outline-none focus:ring-2 focus:ring-[#0B2A55]"
              placeholder="you@example.com"
              autoComplete="email"
            />

            {error && <p className="text-red-600 text-sm mb-4 text-center">{error}</p>}

            <button
              type="submit"
              disabled={sending || !email.trim()}
              className="w-full bg-[#0B2A55] text-white rounded-md py-3 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? "Sending reset link..." : "Send Reset Link"}
            </button>

            <button
              type="button"
              onClick={() => window.history.back()}
              className="w-full mt-3 flex items-center justify-center gap-1.5 text-sm text-[#0B2A55] hover:underline"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Login
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
