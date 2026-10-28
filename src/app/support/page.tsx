import type { Metadata } from "next";
import Link from "next/link";
import { CareCircleMark } from "@/components/brand";
import { getSystemName } from "@/lib/brand/system-name";

export async function generateMetadata(): Promise<Metadata> {
  const systemName = await getSystemName();
  return {
    title: "Contact Support",
    description: `Get help with a ${systemName} account.`,
  };
}

export default async function SupportPage() {
  const systemName = await getSystemName();
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-4 bg-brand-paper px-4 py-10 text-brand-ink sm:px-8">
      <Link href="/" className="flex w-fit items-center gap-2 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-teal">
        <CareCircleMark className="h-9 w-9" />
        <span className="text-sm font-medium tracking-[0.16em] text-brand-teal uppercase">{systemName}</span>
      </Link>
      <h1 className="text-3xl font-semibold tracking-tight">Contact Support</h1>
      <p className="leading-7">
        For help signing in, use Forgot password on the sign-in page. For other account questions, contact your {systemName} clinic administrator.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link href="/login" className="text-sm font-semibold text-brand-teal underline">
          Back to sign in
        </Link>
        <Link href="/forgot-password" className="text-sm font-semibold text-brand-teal underline">
          Forgot password
        </Link>
      </div>
    </main>
  );
}
