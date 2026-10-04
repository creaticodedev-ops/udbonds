/**
 * Super Admin theme tokens — scoped under .sa-app[data-theme].
 * Not inverted colors: distinct light/dark surfaces.
 */
export const SA_THEME_KEY = 'sa_theme'

export const getInitialSaTheme = () => {
  try {
    const saved = localStorage.getItem(SA_THEME_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches) {
    return 'light'
  }
  return 'dark'
}

export const saThemeStyles = `
.sa-app {
  --sa-font: "IBM Plex Sans", "Segoe UI", system-ui, sans-serif;
  --sa-display: "Fraunces", "IBM Plex Serif", Georgia, serif;
  --sa-radius: 10px;
  --sa-radius-sm: 8px;
  --sa-focus: 0 0 0 3px color-mix(in srgb, var(--sa-accent) 35%, transparent);
  font-family: var(--sa-font);
  color: var(--sa-text);
  background: var(--sa-bg);
  min-height: 100svh;
  overflow-x: hidden;
}

.sa-app[data-theme="dark"] {
  --sa-bg: #0c0b0b;
  --sa-bg-elevated: #121010;
  --sa-surface: #161413;
  --sa-surface-2: #1c1917;
  --sa-border: rgba(255,255,255,0.08);
  --sa-border-strong: rgba(255,255,255,0.14);
  --sa-text: #f4efe9;
  --sa-text-secondary: #b7aea6;
  --sa-text-muted: #7d756d;
  --sa-accent: #c45c4a;
  --sa-accent-hover: #d46b58;
  --sa-accent-soft: rgba(196,92,74,0.14);
  --sa-danger: #f87171;
  --sa-danger-soft: rgba(248,113,113,0.12);
  --sa-warn: #e8b86d;
  --sa-warn-soft: rgba(232,184,109,0.12);
  --sa-success: #34d399;
  --sa-success-soft: rgba(52,211,153,0.12);
  --sa-info: #7dd3fc;
  --sa-info-soft: rgba(125,211,252,0.12);
  --sa-sidebar: #0a0909;
  --sa-overlay: rgba(6,4,4,0.62);
  --sa-shadow: 0 16px 40px rgba(0,0,0,0.4);
  --sa-chart-1: #c45c4a;
  --sa-chart-2: #7dd3fc;
  --sa-chart-3: #34d399;
  --sa-chart-4: #e8b86d;
  --sa-input-bg: #100e0d;
  --sa-on-accent: #fffaf7;
}

.sa-app[data-theme="light"] {
  --sa-bg: #f6f3ef;
  --sa-bg-elevated: #fffcf9;
  --sa-surface: #ffffff;
  --sa-surface-2: #f8f5f1;
  --sa-border: rgba(28,18,14,0.08);
  --sa-border-strong: rgba(28,18,14,0.14);
  --sa-text: #1c140f;
  --sa-text-secondary: #5c534c;
  --sa-text-muted: #7a716a;
  --sa-accent: #A51624;
  --sa-accent-hover: #8C131F;
  --sa-accent-soft: rgba(165, 22, 36,0.1);
  --sa-danger: #b42318;
  --sa-danger-soft: rgba(180,35,24,0.08);
  --sa-warn: #b45309;
  --sa-warn-soft: rgba(180,83,9,0.1);
  --sa-success: #047857;
  --sa-success-soft: rgba(4,120,87,0.1);
  --sa-info: #0369a1;
  --sa-info-soft: rgba(3,105,161,0.1);
  --sa-sidebar: #ffffff;
  --sa-overlay: rgba(28,18,14,0.42);
  --sa-shadow: 0 12px 32px rgba(28,18,14,0.08);
  --sa-chart-1: #A51624;
  --sa-chart-2: #0369a1;
  --sa-chart-3: #047857;
  --sa-chart-4: #b45309;
  --sa-input-bg: #ffffff;
  --sa-on-accent: #ffffff;
}

.sa-app * { box-sizing: border-box; }
.sa-app a { color: inherit; }
.sa-app button:focus-visible,
.sa-app a:focus-visible,
.sa-app input:focus-visible,
.sa-app select:focus-visible,
.sa-app textarea:focus-visible {
  outline: none;
  box-shadow: var(--sa-focus);
}
.sa-app .sa-shimmer {
  background: linear-gradient(90deg, var(--sa-border) 0%, var(--sa-surface-2) 50%, var(--sa-border) 100%);
  background-size: 200% 100%;
  animation: sa-shimmer 1.35s ease-in-out infinite;
}
@keyframes sa-shimmer {
  0% { background-position: 100% 0; }
  100% { background-position: -100% 0; }
}
.sa-app input[type="checkbox"],
.sa-app input[type="radio"] {
  accent-color: var(--sa-accent);
}
.sa-scrollbar::-webkit-scrollbar-thumb {
  background: var(--sa-border-strong);
  border-radius: 999px;
}
`

export default { SA_THEME_KEY, getInitialSaTheme, saThemeStyles }
