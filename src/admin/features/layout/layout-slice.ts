import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type LayoutMode = "default" | "compact" | "icon" | "horizontal";
export type NavColor = "integrate" | "apparent";

export const FONT_SCALE_OPTIONS = [0.9, 1, 1.1, 1.2, 1.3];
export const FONT_SCALE_STEP = 0.1;
export const FONT_SCALE_DEFAULT = 1;

/**
 * Snaps an arbitrary scale (e.g. a value persisted by an older build) onto the
 * nearest supported option so the slider always reflects the stored state.
 */
const normalizeFontScale = (value: number) => {
  if (!Number.isFinite(value)) return FONT_SCALE_DEFAULT;

  return FONT_SCALE_OPTIONS.reduce((closest, option) =>
    Math.abs(option - value) < Math.abs(closest - value) ? option : closest,
  );
};

/**
 * The color scheme is deliberately absent here: Mantine owns it through
 * localStorageColorSchemeManager, which already persists it under
 * ADMIN_COLOR_SCHEME_KEY and syncs it between tabs. Mirroring it in Redux gave
 * two writers for one setting and made tabs fight over the value.
 */
export type LayoutState = {
  layoutMode: LayoutMode;
  navColor: NavColor;
  fontScale: number;
  compact: boolean;
  contrast: boolean;
  isHydrated: boolean;
};

const initialState: LayoutState = {
  layoutMode: "default",
  navColor: "apparent",
  fontScale: FONT_SCALE_DEFAULT,
  compact: false,
  contrast: false,
  isHydrated: false,
};

const layoutSlice = createSlice({
  name: "layout",
  initialState,
  reducers: {
    setLayoutMode: (state, action: PayloadAction<LayoutMode>) => {
      state.layoutMode = action.payload;
      state.isHydrated = true;
    },
    setNavColor: (state, action: PayloadAction<NavColor>) => {
      state.navColor = action.payload;
      state.isHydrated = true;
    },
    setFontScale: (state, action: PayloadAction<number>) => {
      state.fontScale = normalizeFontScale(action.payload);
      state.isHydrated = true;
    },
    initializeSettings: (
      state,
      action: PayloadAction<Partial<LayoutState> | null>,
    ) => {
      const settings = action.payload;
      if (settings) {
        state.layoutMode = settings.layoutMode ?? state.layoutMode;
        state.navColor = settings.navColor ?? state.navColor;
        state.fontScale = normalizeFontScale(
          settings.fontScale ?? state.fontScale,
        );
        state.compact = settings.compact ?? state.compact;
        state.contrast = settings.contrast ?? state.contrast;
      }
      state.isHydrated = true;
    },
    resetSettings: () => ({ ...initialState, isHydrated: true }),
  },
});

export const {
  setLayoutMode,
  setNavColor,
  setFontScale,
  initializeSettings,
  resetSettings,
} = layoutSlice.actions;

export default layoutSlice.reducer;
