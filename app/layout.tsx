import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@/frontend/styles/globals.css";
import { Navigation } from "@/frontend/components/layout/Navigation";
import { Toaster } from "@/frontend/components/ui/Toaster";
import { AnalysisPanelProvider } from "@/frontend/components/jobs/AnalysisPanelProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "JobAssist AI — Smart Job Discovery",
  description: "AI-powered job discovery, smart matching, and one-click resume tailoring",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-gray-950 text-white min-h-screen`} suppressHydrationWarning>
        <AnalysisPanelProvider>
          <Navigation />
          <main className="pt-16 min-h-screen">{children}</main>
          <Toaster />
        </AnalysisPanelProvider>
      </body>
    </html>
  );
}
