"use client";

import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Feature #2 — ThemeToggle
 * Cycles between "light" → "dark" → "system" using next-themes.
 * Renders nothing on the server (avoids hydration mismatch).
 */
export default function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch — only render after mount
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-8 w-8" />;

  const cycle = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  };

  const Icon = theme === "dark" ? Moon : theme === "system" ? Monitor : Sun;

  const label =
    theme === "dark" ? "Dark mode" : theme === "system" ? "System theme" : "Light mode";

  const iconColor =
    resolvedTheme === "dark" ? "text-indigo-300" : "text-amber-500";

  return (
    <button
      onClick={cycle}
      title={`Current: ${label} — click to change`}
      className="
        flex h-8 w-8 items-center justify-center rounded-lg
        border border-slate-200 dark:border-slate-600
        bg-white dark:bg-slate-800
        hover:bg-slate-50 dark:hover:bg-slate-700
        transition-colors
      "
    >
      <Icon size={15} className={iconColor} />
    </button>
  );
}
