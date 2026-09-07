"use client";

import {
  ActionIcon,
  Affix,
  AppShell,
  Box,
  Transition,
} from "@mantine/core";
import { useDisclosure, useMediaQuery, useWindowScroll } from "@mantine/hooks";
import {
  IconArrowUp,
  IconChevronLeft,
  IconChevronRight,
} from "@tabler/icons-react";
import type { ReactNode } from "react";
import type { AdminUser } from "../../session";
import {
  setLayoutMode,
  type LayoutMode,
} from "../features/layout/layout-slice";
import { useAppDispatch, useAppSelector } from "../hooks";
import { AdminHeader } from "./admin-header";
import { AdminSettingsDrawer } from "./admin-settings-drawer";
import classes from "./admin-shell.module.css";
import HorizontalMenu from "./navigation/horizontal-menu";
import IconSidebar from "./navigation/icon-sidebar";
import SidebarCompact from "./navigation/sidebar-compact";
import SidebarDefault from "./navigation/sidebar-default";
import SidebarDrawer from "./navigation/sidebar-drawer";

const navbarWidths: Record<LayoutMode, number> = {
  default: 300,
  compact: 90,
  icon: 64,
  horizontal: 0,
};

function resolveLayoutMode(
  mode: LayoutMode,
  drawerScreen: boolean,
  autoCompactScreen: boolean,
) {
  if (drawerScreen) {
    return "default";
  }

  if (autoCompactScreen && mode === "default") {
    return "compact";
  }

  return mode;
}

export function AdminShell({
  user,
  children,
}: Readonly<{ user: AdminUser; children: ReactNode }>) {
  const dispatch = useAppDispatch();
  const {
    layoutMode,
    navColor,
    isHydrated: hydrated,
  } = useAppSelector((state) => state.layout);
  const [mobileOpened, mobileHandlers] = useDisclosure(false);
  const [settingsOpened, settingsHandlers] = useDisclosure(false);
  const drawerScreen = useMediaQuery("(max-width: 35.999em)") ?? false;
  const autoCompactScreen =
    useMediaQuery("(min-width: 36em) and (max-width: 74.999em)") ?? false;
  const desktopScreen = useMediaQuery("(min-width: 75em)") ?? false;
  const [scroll, scrollTo] = useWindowScroll();
  const effectiveMode = resolveLayoutMode(
    layoutMode,
    drawerScreen,
    autoCompactScreen,
  );
  const horizontal = !drawerScreen && effectiveMode === "horizontal";
  const headerHeight = horizontal ? 128 : 72;
  const canToggle =
    desktopScreen &&
    (effectiveMode === "default" || effectiveMode === "compact");
  const nextMode: LayoutMode =
    effectiveMode === "default" ? "compact" : "default";

  return (
    <AppShell
      padding={0}
      layout={horizontal ? "default" : "alt"}
      header={{ height: headerHeight }}
      navbar={
        horizontal
          ? undefined
          : {
              width: navbarWidths[effectiveMode],
              breakpoint: "xs",
              collapsed: { mobile: true },
            }
      }
      className={classes.appShell}
      data-nav-color={navColor}
      data-nav-layout={effectiveMode}
    >
      <AppShell.Header
        className={classes.header}
        data-horizontal={horizontal}
        data-scrolled={scroll.y > 0}
      >
        <AdminHeader
          user={user}
          mobileOpened={mobileOpened}
          onToggleMobileAction={mobileHandlers.toggle}
          onOpenSettingsAction={settingsHandlers.open}
          showBrand={horizontal || drawerScreen}
        />
        {horizontal && (
          <Box className={classes.horizontalMenu}>
            <HorizontalMenu />
          </Box>
        )}
      </AppShell.Header>

      {!horizontal && (
          <AppShell.Navbar
            className={classes.navbar}
            aria-hidden={drawerScreen || undefined}
            inert={drawerScreen || undefined}
          >
          {canToggle && (
            <Box className={classes.sidebarToggleWrapper}>
              <ActionIcon
                className={classes.sidebarToggle}
                variant="default"
                radius="xl"
                size="sm"
                aria-label={nextMode === "default" ? "ขยายเมนู" : "ย่อเมนู"}
                onClick={() => dispatch(setLayoutMode(nextMode))}
              >
                {effectiveMode === "compact" ? (
                  <IconChevronRight size={16} />
                ) : (
                  <IconChevronLeft size={16} />
                )}
              </ActionIcon>
            </Box>
          )}
          {effectiveMode === "compact" ? (
            <SidebarCompact />
          ) : effectiveMode === "icon" ? (
            <IconSidebar />
          ) : (
            <SidebarDefault />
          )}
        </AppShell.Navbar>
      )}

      <SidebarDrawer
        opened={mobileOpened}
        onCloseAction={mobileHandlers.close}
        navColor={navColor}
      />

      <AppShell.Main className={classes.main}>
        <Box className={classes.mainContent}>{children}</Box>
      </AppShell.Main>

      <AdminSettingsDrawer
        opened={settingsOpened}
        onCloseAction={settingsHandlers.close}
      />

      <Transition transition="slide-up" mounted={scroll.y > 320}>
        {(transitionStyles) => (
          <Affix position={{ bottom: 24, right: 24 }} style={transitionStyles}>
            <ActionIcon
              size="lg"
              radius="xl"
              variant="filled"
              aria-label="กลับด้านบน"
              onClick={() => scrollTo({ y: 0 })}
            >
              <IconArrowUp size={19} />
            </ActionIcon>
          </Affix>
        )}
      </Transition>

      {!hydrated && <Box className={classes.hydrationCover} />}
    </AppShell>
  );
}
