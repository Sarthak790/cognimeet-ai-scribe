import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CogniMeet",
  description: "Autonomous AI meeting summaries.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      {/* Add suppressHydrationWarning here! 
        This tells React to ignore Grammarly injecting its code.
      */}
      <body className={inter.className} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}