"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogIn, KeyRound, Store } from "lucide-react";
import { ownerLoginAction, recoverAction } from "./actions";

const inputCls =
  "w-full rounded-xl border border-edge/10 bg-edge/[0.03] px-3.5 py-3 text-[14px] text-ink outline-none transition placeholder:text-ink-3/60 focus:border-nova focus:ring-2 focus:ring-nova/20";

export function LoginForm({ storeName, redirectTo }: { storeName: string; redirectTo: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "recover">("login");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");

  const submit = () =>
    start(async () => {
      setError(null);
      const r = mode === "login" ? await ownerLoginAction({ email, password }) : await recoverAction({ code, password });
      if (r.ok) {
        router.replace(redirectTo);
        router.refresh();
      } else setError(r.error);
    });

  return (
    <div dir="rtl" className="dash dash-cosmos dark grid min-h-dvh place-items-center px-4 py-10 text-ink">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="dash-card w-full max-w-sm space-y-5 p-6"
      >
        <div className="text-center">
          <span className="mx-auto mb-3 grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-nova to-aurora text-white shadow-xl shadow-nova/30">
            <Store className="size-5" />
          </span>
          <h1 className="text-xl font-black">لوحة تحكم {storeName}</h1>
          <p className="mt-1 text-[12.5px] text-ink-2">{mode === "login" ? "ادخل ببريدك وكلمة المرور" : "اكتب كود الاسترجاع وكلمة مرور جديدة"}</p>
        </div>

        {mode === "login" ? (
          <label className="block space-y-1.5">
            <span className="text-[12.5px] font-bold">البريد</span>
            <input type="email" dir="ltr" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} required />
          </label>
        ) : (
          <label className="block space-y-1.5">
            <span className="text-[12.5px] font-bold">كود الاسترجاع</span>
            <input dir="ltr" autoComplete="off" value={code} onChange={(e) => setCode(e.target.value)} className={`${inputCls} font-mono uppercase`} required />
          </label>
        )}
        <label className="block space-y-1.5">
          <span className="text-[12.5px] font-bold">{mode === "login" ? "كلمة المرور" : "كلمة المرور الجديدة"}</span>
          <input
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputCls}
            required
          />
        </label>

        {error ? (
          <p role="alert" className="rounded-xl bg-rose-400/10 px-3.5 py-2.5 text-[12.5px] text-rose-300">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-nova to-nova-deep text-sm font-black text-white shadow-lg shadow-nova/30 disabled:opacity-60"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : mode === "login" ? <LogIn className="size-4" /> : <KeyRound className="size-4" />}
          {mode === "login" ? "دخول" : "غيّر كلمة المرور وادخل"}
        </button>
        <button
          type="button"
          onClick={() => {
            setMode(mode === "login" ? "recover" : "login");
            setError(null);
          }}
          className="block w-full text-center text-[12.5px] font-bold text-ink-2 hover:text-ink"
        >
          {mode === "login" ? "نسيت كلمة المرور؟" : "رجوع لتسجيل الدخول"}
        </button>
      </form>
    </div>
  );
}
