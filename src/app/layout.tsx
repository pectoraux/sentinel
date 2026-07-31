import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { bootstrapRuntime } from "@/lib/runtime";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sentinel — Community Intelligence Platform",
  description:
    "Sentinel: AI-native Community Intelligence & Digital Twin platform for detecting, verifying and predicting illegal mining and environmental crimes across Africa.",
  keywords: [
    "Sentinel",
    "illegal mining",
    "environmental crimes",
    "community intelligence",
    "digital twin",
    "PostGIS",
    "Africa",
  ],
  authors: [{ name: "Sentinel Platform" }],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Bootstrap server-side subsystems once per server lifecycle.
  await bootstrapRuntime();

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${mono.variable} antialiased bg-background text-foreground min-h-screen flex flex-col`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
