"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { useTheme } from "@/frontend/components/ui/ThemeProvider";
import { Briefcase, LayoutDashboard, FileText, Kanban, Sparkles, List, Sun, Moon } from "lucide-react";
import { cn } from "@/backend/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/swipe", label: "Discover", icon: Sparkles },
  { href: "/jobs", label: "Jobs", icon: List },
  { href: "/resume", label: "Resume", icon: FileText },
  { href: "/applications", label: "Applications", icon: Kanban },
];

export function Navigation() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-gray-950/90 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
            <Briefcase size={16} className="text-white" />
          </div>
          <span className="font-bold text-white text-lg tracking-tight">
            Job<span className="text-violet-400">Assist</span>
            <span className="text-violet-400 ml-0.5">AI</span>
          </span>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== "/" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-150",
                  active
                    ? "bg-violet-500/15 text-violet-400 border border-violet-500/20"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                )}
              >
                <Icon size={15} />
                {label}
              </Link>
            );
          })}

          {/* Theme toggle */}
          <button
            type="button"
            onClick={() => setTheme((theme ?? "dark") === "light" ? "dark" : "light")}
            title={mounted && theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
            className="ml-1 p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-all duration-150"
          >
            {mounted && theme === "light" ? <Moon size={15} /> : <Sun size={15} />}
          </button>
        </div>
      </div>
    </nav>
  );
}
