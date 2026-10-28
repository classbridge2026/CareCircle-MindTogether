import type { Metadata } from "next";
import { Suspense } from "react";
import { ButtonBusy } from "@/components/button-busy";
import { metadataBase } from "@/lib/brand/metadata-base";
import { getSystemName } from "@/lib/brand/system-name";
import "./globals.css";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const systemName = await getSystemName();
  return {
    metadataBase: metadataBase(),
    title: {
      default: systemName,
      template: `%s · ${systemName}`,
    },
    description: `${systemName} is a healthcare platform for appointments and online consultations in Sierra Leone.`,
    openGraph: {
      siteName: systemName,
      images: [{ url: "/carecircle-logo.png", alt: systemName }],
    },
  };
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <Suspense fallback={null}>
          <ButtonBusy />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
