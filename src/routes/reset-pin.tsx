import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { KeyRound, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

export const Route = createFileRoute("/reset-pin")({ component: ResetPinPage });

function ResetPinPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      // Supabase fires PASSWORD_RECOVERY when a recovery link is validated,
      // which grants a recovery session where updateUser({ password }) works.
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
        setChecking(false);
      }
    });

    // Cover the case where the recovery session is already established on load.
    supabase.auth
      .getSession()
      .then(({ data }) => {
        // A recovery session carries a flag; the safest signal is the event
        // above, so we fall back to enabling only if a recovery flag is present.
        const user = data.session?.user as any;
        if (user?.user_metadata?.recovery) {
          setReady(true);
        }
        setChecking(false);
      })
      .catch(() => setChecking(false));

    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!/^\d{6}$/.test(newPin)) {
      setError("PIN must contain exactly 6 digits.");
      return;
    }
    if (newPin !== confirmPin) {
      setError("PINs do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const { error: updateErr } = await supabase.auth.updateUser({ password: newPin });
      if (updateErr) {
        console.error("updateUser error:", updateErr);
        setError("Unable to reset your PIN. Your link may have expired — please request a new one.");
        return;
      }

      // Best-effort mirror to profiles.pin for consistency with the Admin reset
      // flow. Not required for login (login reads the Supabase Auth password),
      // and a failure here must never block the flow.
      const { data: user } = await supabase.auth.getUser();
      if (user?.user?.id) {
        try {
          await supabase.from("profiles").update({ pin: newPin }).eq("auth_user_id", user.user.id);
        } catch (mirrorErr) {
          console.warn("profiles.pin mirror failed (non-blocking):", mirrorErr);
        }
      }

      setDone(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F6FA]">
        <div className="bg-white rounded-lg shadow-md p-10 w-full max-w-sm border border-gray-100 text-center">
          <div className="w-16 h-16 rounded-lg bg-[#0B2A55] flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-lg font-bold text-[#0B2A55] tracking-wide mb-2">PIN Reset Successful</h1>
          <p className="text-sm text-gray-600 mb-6">
            Your 6-digit PIN has been reset successfully. You can now log in with your new PIN.
          </p>
          <button
            type="button"
            onClick={() => navigate({ to: "/" })}
            className="w-full bg-[#0B2A55] text-white rounded-md py-3 font-medium hover:bg-[#0A2344]"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F6FA]">
      <div className="bg-white rounded-lg shadow-md p-10 w-full max-w-sm border border-gray-100">
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 rounded-lg bg-[#0B2A55] flex items-center justify-center mb-4">
            <KeyRound className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-lg font-bold text-[#0B2A55] tracking-wide">Reset Your PIN</h1>
          <p className="text-xs text-gray-500 text-center mt-1">Enter a new 6-digit PIN.</p>
        </div>

        {checking ? (
          <p className="text-center text-sm text-gray-500 py-4">Checking recovery link...</p>
        ) : !ready ? (
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-6">
              This reset link is invalid or has expired. Please request a new reset link from the Forgot PIN page.
            </p>
            <Link
              to="/forgot-pin"
              className="w-full inline-block text-center bg-[#0B2A55] text-white rounded-md py-3 font-medium hover:bg-[#0A2344]"
            >
              Request New Link
            </Link>
            <Link to="/" className="block mt-3 text-sm text-[#0B2A55] hover:underline">
              Back to Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <label className="block text-sm font-medium text-gray-700 mb-2">New 6-Digit PIN</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
              className="w-full text-center tracking-[0.5em] text-2xl border border-gray-300 rounded-md py-3 mb-4 focus:outline-none focus:ring-2 focus:ring-[#0B2A55]"
              placeholder="••••••"
              autoFocus
            />

            <label className="block text-sm font-medium text-gray-700 mb-2">Confirm 6-Digit PIN</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
              className="w-full text-center tracking-[0.5em] text-2xl border border-gray-300 rounded-md py-3 mb-4 focus:outline-none focus:ring-2 focus:ring-[#0B2A55]"
              placeholder="••••••"
            />

            {error && <p className="text-red-600 text-sm mb-4 text-center">{error}</p>}

            <button
              type="submit"
              disabled={submitting || newPin.length !== 6 || confirmPin.length !== 6}
              className="w-full bg-[#0B2A55] text-white rounded-md py-3 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Resetting..." : "Reset PIN"}
            </button>

            <Link to="/" className="block mt-3 text-center text-sm text-[#0B2A55] hover:underline">
              Back to Login
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
