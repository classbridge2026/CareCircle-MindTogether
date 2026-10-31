"use client";

import { useCallback, useState } from "react";
import { primaryButtonClass } from "@/components/form-classes";
import { SupportRequestForm } from "@/components/support/support-form";

export function AccountSupportPanel() {
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [formKey, setFormKey] = useState(0);
  const hideAfterSubmit = useCallback((message: string) => {
    setNotice(message);
    setOpen(false);
    setFormKey((current) => current + 1);
  }, []);

  return (
    <div id="account-support" className="scroll-mt-24 rounded-2xl border border-brand-line bg-white p-5 shadow-sm sm:p-6 lg:col-span-2">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-xl font-semibold text-brand-navy">Account support</h3>
          <p className="mt-2 text-sm leading-6 text-brand-muted">Use the email on the account. If you are locked out, use an email where an administrator can reply.</p>
        </div>
        {open ? null : (
          <button type="button" className={`${primaryButtonClass} shrink-0`} aria-expanded={false} onClick={() => { setNotice(""); setOpen(true); }}>
            Account support
          </button>
        )}
      </div>
      {notice && !open ? (
        <p role="status" className="mt-4 rounded-xl bg-[#e7f3f1] px-4 py-3 text-sm leading-6 text-[#0b5f59]">
          {notice}
        </p>
      ) : null}
      {open ? (
        <div className="mt-5">
          <SupportRequestForm key={formKey} onSubmitted={hideAfterSubmit} />
        </div>
      ) : null}
    </div>
  );
}
