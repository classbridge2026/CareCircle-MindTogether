import type { Metadata } from "next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ButtonBusy } from "@/components/button-busy";
import { metadataBase } from "@/lib/brand/metadata-base";
import { DEFAULT_SYSTEM_NAME } from "@/lib/brand/system-name";
import "./globals.css";

export function generateMetadata(): Metadata {
  return {
    metadataBase: metadataBase(),
    title: {
      default: DEFAULT_SYSTEM_NAME,
      template: `%s · ${DEFAULT_SYSTEM_NAME}`,
    },
    description: `${DEFAULT_SYSTEM_NAME} is a healthcare platform for appointments and online consultations in Sierra Leone.`,
    openGraph: {
      siteName: DEFAULT_SYSTEM_NAME,
      images: [{ url: "/carecircle-logo.png", alt: DEFAULT_SYSTEM_NAME }],
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
        <ButtonBusy />
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
