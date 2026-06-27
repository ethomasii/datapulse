import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Analytics } from "@vercel/analytics/next";
import { ThemeProvider } from "@/components/theme-provider";
import { isClerkConfigured } from "@/lib/clerk/is-configured";
import "./globals.css";
import "@xyflow/react/dist/style.css";

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#020617" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: {
    default: "eltPulse — Visual ELT for any warehouse",
    template: "%s | eltPulse",
  },
  description:
    "Visual pipeline canvas and Pulse AI for EL+T — on Snowflake, BigQuery, MotherDuck, and more. Fivetran-grade connectors, run slices, Git-native code export.",
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "eltPulse",
    title: "eltPulse — Visual ELT for any warehouse",
    description:
      "Visual pipeline canvas, Pulse AI, and 111+ connectors. Designer-grade EL+T without warehouse lock-in.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();
  const shell = (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );

  if (!isClerkConfigured() || !clerkKey) {
    return shell;
  }

  return <ClerkProvider publishableKey={clerkKey}>{shell}</ClerkProvider>;
}
