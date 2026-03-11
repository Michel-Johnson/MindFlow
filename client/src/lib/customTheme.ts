export type CustomThemeSettings = {
  backgroundOverlayAlpha: number; // 0..1
  sidebarAlpha: number; // 0..1
  toolbarAlpha: number; // 0..1
  nodeAlpha: number; // 0..1
};

export const CUSTOM_THEME_BG_KEY = "custom-theme-bg";
const STORAGE_KEY = "mindflow-custom-theme";

export const defaultCustomThemeSettings: CustomThemeSettings = {
  backgroundOverlayAlpha: 0.35,
  sidebarAlpha: 0.28,
  toolbarAlpha: 0.7,
  nodeAlpha: 0.98,
};

export function loadCustomThemeSettings(): CustomThemeSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultCustomThemeSettings;
    const parsed = JSON.parse(raw) as Partial<CustomThemeSettings>;
    return {
      backgroundOverlayAlpha:
        clamp01(parsed.backgroundOverlayAlpha ?? defaultCustomThemeSettings.backgroundOverlayAlpha),
      sidebarAlpha: clamp01(parsed.sidebarAlpha ?? defaultCustomThemeSettings.sidebarAlpha),
      toolbarAlpha: clamp01(parsed.toolbarAlpha ?? defaultCustomThemeSettings.toolbarAlpha),
      nodeAlpha: clamp01(parsed.nodeAlpha ?? defaultCustomThemeSettings.nodeAlpha),
    };
  } catch {
    return defaultCustomThemeSettings;
  }
}

export function saveCustomThemeSettings(settings: CustomThemeSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function clamp01(value: number) {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

