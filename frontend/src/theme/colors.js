const themeModeKey = "nexenstial-theme-mode";
export const themeModeOptions = ["light", "dark", "system"];

export const theme = {
  modes: {
    light: {
      colors: {
        black: "#111827",
        grey: "#f4f6f9",
        peach: "#f97316",
        purple: "#7c3aed",
        green: "#047857",

        background: "#f4f6f9",
        surface: "#ffffff",
        surfaceSoft: "#f8fafc",
        text: "#111827",
        textMuted: "#667085",
        border: "#e4e7ec",
        primary: "#2563eb",
        accent: "#dc2626",
        success: "#047857",
      },
      shadow: {
        card: "0 12px 32px rgba(15, 23, 42, 0.08)",
        panel: "0 18px 48px rgba(15, 23, 42, 0.12)",
        button: "0 10px 24px rgba(37, 99, 235, 0.18)",
      },
    },

    dark: {
      colors: {
        black: "#020617",
        grey: "#0f172a",
        peach: "#fb923c",
        purple: "#a78bfa",
        green: "#34d399",

        background: "#0f172a",
        surface: "#111827",
        surfaceSoft: "#1f2937",
        text: "#f8fafc",
        textMuted: "#cbd5e1",
        border: "#334155",
        primary: "#60a5fa",
        accent: "#f87171",
        success: "#34d399",
      },
      shadow: {
        card: "0 14px 40px rgba(0, 0, 0, 0.34)",
        panel: "0 20px 56px rgba(0, 0, 0, 0.44)",
        button: "0 10px 24px rgba(96, 165, 250, 0.24)",
      },
    },
  },

  typography: {
    fontFamily:
      "Inter, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
    sizeXs: "12px",
    sizeSm: "14px",
    sizeMd: "16px",
    sizeLg: "18px",
    sizeXl: "24px",
    sizeHero: "40px",
    weightRegular: 400,
    weightMedium: 600,
    weightBold: 800,
    lineHeight: 1.5,
  },

  radius: {
    sm: "8px",
    md: "10px",
    lg: "12px",
    xl: "16px",
    pill: "999px",
  },

  border: {
    width: "1px",
    style: "solid",
  },

  layout: {
    sidebarExpanded: "280px",
    sidebarCollapsed: "86px",
    contentPadding: "24px",
    headerPadding: "28px",
    controlHeight: "42px",
  },
};

export const getSystemThemeMode = () => {
  if (typeof window === "undefined" || !window.matchMedia) return "light";

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
};

export const getThemePreference = () => {
  if (typeof window === "undefined") return "light";

  const savedMode = window.localStorage.getItem(themeModeKey);
  return themeModeOptions.includes(savedMode) ? savedMode : "system";
};

export const resolveThemeMode = (mode = getThemePreference()) => {
  if (mode === "system") return getSystemThemeMode();

  return mode === "dark" ? "dark" : "light";
};

export const getThemeMode = () => {
  return resolveThemeMode(getThemePreference());
};

export const getThemeByMode = (mode = getThemeMode()) => {
  return theme.modes[resolveThemeMode(mode)];
};

export const themeColors = getThemeByMode("light").colors;

export const getCssThemeVariables = (mode = getThemeMode()) => {
  const activeTheme = getThemeByMode(mode);
  const { colors, shadow } = activeTheme;

  return {
    "--nx-black": colors.black,
    "--nx-grey": colors.grey,
    "--nx-peach": colors.peach,
    "--nx-purple": colors.purple,
    "--nx-green": colors.green,

    "--nx-bg": colors.background,
    "--nx-surface": colors.surface,
    "--nx-surface-soft": colors.surfaceSoft,
    "--nx-text": colors.text,
    "--nx-text-muted": colors.textMuted,
    "--nx-border-color": colors.border,
    "--nx-primary": colors.primary,
    "--nx-accent": colors.accent,
    "--nx-success": colors.success,

    "--nx-font-family": theme.typography.fontFamily,
    "--nx-font-size-xs": theme.typography.sizeXs,
    "--nx-font-size-sm": theme.typography.sizeSm,
    "--nx-font-size-md": theme.typography.sizeMd,
    "--nx-font-size-lg": theme.typography.sizeLg,
    "--nx-font-size-xl": theme.typography.sizeXl,
    "--nx-font-size-hero": theme.typography.sizeHero,
    "--nx-font-weight-regular": theme.typography.weightRegular,
    "--nx-font-weight-medium": theme.typography.weightMedium,
    "--nx-font-weight-bold": theme.typography.weightBold,
    "--nx-line-height": theme.typography.lineHeight,

    "--nx-radius-sm": theme.radius.sm,
    "--nx-radius-md": theme.radius.md,
    "--nx-radius-lg": theme.radius.lg,
    "--nx-radius-xl": theme.radius.xl,
    "--nx-radius-pill": theme.radius.pill,

    "--nx-border-width": theme.border.width,
    "--nx-border-style": theme.border.style,

    "--nx-shadow-card": shadow.card,
    "--nx-shadow-panel": shadow.panel,
    "--nx-shadow-button": shadow.button,

    "--nx-sidebar-expanded": theme.layout.sidebarExpanded,
    "--nx-sidebar-collapsed": theme.layout.sidebarCollapsed,
    "--nx-content-padding": theme.layout.contentPadding,
    "--nx-header-padding": theme.layout.headerPadding,
    "--nx-control-height": theme.layout.controlHeight,
  };
};

export const cssThemeVariables = getCssThemeVariables("light");
export const cssColorVariables = cssThemeVariables;

export const applyThemeColors = (
  mode = getThemePreference(),
  root = document.documentElement,
) => {
  const selectedPreference = themeModeOptions.includes(mode) ? mode : "system";
  const selectedMode = resolveThemeMode(selectedPreference);

  root.dataset.theme = selectedMode;
  root.dataset.themePreference = selectedPreference;

  Object.entries(getCssThemeVariables(selectedMode)).forEach(([name, value]) => {
    root.style.setProperty(name, value);
  });
};

export const applyDesignTokens = applyThemeColors;

export const setThemeMode = (mode) => {
  const selectedPreference = themeModeOptions.includes(mode) ? mode : "system";

  window.localStorage.setItem(themeModeKey, selectedPreference);
  applyThemeColors(selectedPreference);

  return selectedPreference;
};

export const toggleThemeMode = () => {
  const nextMode = getThemeMode() === "dark" ? "light" : "dark";
  return setThemeMode(nextMode);
};

export const getAntThemeTokens = (isDarkTheme = false) => {
  const activeTheme = getThemeByMode(isDarkTheme ? "dark" : "light");
  const { colors, shadow } = activeTheme;

  return {
    colorPrimary: colors.primary,
    colorSuccess: colors.success,
    colorWarning: colors.accent,

    colorBgLayout: colors.background,
    colorBgContainer: colors.surface,
    colorBgElevated: colors.surface,
    colorFillSecondary: colors.surfaceSoft,

    colorBorder: colors.border,
    colorBorderSecondary: colors.border,

    colorText: colors.text,
    colorTextSecondary: colors.textMuted,
    colorTextTertiary: colors.textMuted,

    borderRadius: Number.parseInt(theme.radius.md, 10),
    borderRadiusLG: Number.parseInt(theme.radius.lg, 10),
    borderRadiusSM: Number.parseInt(theme.radius.sm, 10),

    fontFamily: theme.typography.fontFamily,
    fontSize: Number.parseInt(theme.typography.sizeMd, 10),
    fontSizeSM: Number.parseInt(theme.typography.sizeSm, 10),
    fontSizeLG: Number.parseInt(theme.typography.sizeLg, 10),
    lineHeight: theme.typography.lineHeight,

    lineWidth: Number.parseInt(theme.border.width, 10),
    controlHeight: Number.parseInt(theme.layout.controlHeight, 10),
    boxShadow: shadow.card,
  };
};
