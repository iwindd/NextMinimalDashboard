import { configureStore } from "@reduxjs/toolkit";
import authReducer, { type AuthState } from "./features/auth/auth-slice";
import layoutReducer from "./features/layout/layout-slice";
import { ADMIN_LAYOUT_SETTINGS_KEY } from "./constants";
import { auditLogsApi } from "./features/audit-log/audit-logs-api";
import { usersApi } from "./features/user/users-api";
import { newsApi } from "./features/news/news-api";
import { notificationsApi } from "./features/notifications/notifications-api";

export type PreloadedState = { auth: AuthState };

export function makeStore(preloadedState: PreloadedState) {
  const store = configureStore({
    reducer: {
      auth: authReducer,
      layout: layoutReducer,
      [usersApi.reducerPath]: usersApi.reducer,
      [auditLogsApi.reducerPath]: auditLogsApi.reducer,
      [newsApi.reducerPath]: newsApi.reducer,
      [notificationsApi.reducerPath]: notificationsApi.reducer,
    },
    preloadedState: {
      auth: preloadedState.auth,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(
        usersApi.middleware,
        auditLogsApi.middleware,
        newsApi.middleware,
        notificationsApi.middleware,
      ),
  });

  let previousLayoutState = store.getState().layout;

  store.subscribe(() => {
    const layout = store.getState().layout;
    if (layout === previousLayoutState) return;
    previousLayoutState = layout;

    if (typeof window !== "undefined" && layout.isHydrated) {
      const { layoutMode, navColor, fontScale, compact, contrast } = layout;
      try {
        window.localStorage.setItem(
          ADMIN_LAYOUT_SETTINGS_KEY,
          JSON.stringify({
            layoutMode,
            navColor,
            fontScale,
            compact,
            contrast,
          }),
        );
      } catch {
        // Ignore storage failures; the in-memory Redux state remains usable.
      }
    }
  });

  return store;
}

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
