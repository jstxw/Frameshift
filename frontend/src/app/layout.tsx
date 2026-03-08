import type { Metadata } from "next";
import localFont from "next/font/local";
import { Auth0Provider } from "@auth0/nextjs-auth0/client";
import { auth0 } from "@/lib/auth0";
import "./globals.css";

const clashDisplay = localFont({
  src: "../fonts/ClashDisplay-Variable.woff2",
  display: "swap",
  variable: "--font-clash",
  weight: "200 700",
});

export const metadata: Metadata = {
  title: "FrameShift — AI Video Editor",
  description:
    "Edit your videos with just an idea. AI-powered editing, no complexity.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth0.getSession().catch(() => null);

  return (
    <html lang="en" className={`${clashDisplay.variable} antialiased`}>
      <body className="font-[family-name:var(--font-clash)]">
        <Auth0Provider user={session?.user}>{children}</Auth0Provider>
      </body>
    </html>
  );
}
