import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@/frontend/styles/globals.css";
import { Navigation } from "@/frontend/components/layout/Navigation";
import { Toaster } from "@/frontend/components/ui/Toaster";
import { UpdateBanner } from "@/frontend/components/ui/UpdateBanner";
import { AnalysisPanelProvider } from "@/frontend/components/jobs/AnalysisPanelProvider";
import { ResumeReviewProvider } from "@/frontend/components/resume/ResumeReviewProvider";
import { ThemeProvider } from "@/frontend/components/ui/ThemeProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "JobAssist AI — Smart Job Discovery",
  description: "AI-powered job discovery, smart matching, and one-click resume tailoring",
  icons: { icon: "/favicon.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} bg-gray-950 text-white min-h-screen`} suppressHydrationWarning>
        <ThemeProvider>
          <AnalysisPanelProvider>
            <ResumeReviewProvider>
              <Navigation />
              <UpdateBanner />
              <main className="pt-16 min-h-screen">{children}</main>
              <Toaster />
            </ResumeReviewProvider>
          </AnalysisPanelProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
