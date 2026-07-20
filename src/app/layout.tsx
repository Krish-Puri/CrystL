import type { Metadata } from "next";
import "./globals.css";
import { AppProvider } from "@/context/AppContext";

export const metadata: Metadata = {
  title: "CrystL — A calm space to be heard",
  description:
    "CrystL is a voice-first emotional support companion that listens, understands, and helps you reflect on your emotional patterns over time.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background antialiased font-sans">
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
