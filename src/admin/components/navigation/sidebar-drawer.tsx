"use client";

import { Anchor, Box, Drawer, ScrollArea } from "@mantine/core";
import Link from "next/link";
import { useRef } from "react";
import type { NavColor } from "../../features/layout/layout-slice";
import { AdminBrand } from "../admin-brand";
import NavigationScrollControls from "./navigation-scroll-controls";
import classes from "./sidebar-drawer.module.css";
import SidebarNavContent from "./sidebar-nav-content";
import { useScrollbarVisibility } from "./use-scrollbar-visibility";

type SidebarDrawerProps = {
  opened: boolean;
  onCloseAction: () => void;
  navColor: NavColor;
};

export default function SidebarDrawer({
  opened,
  onCloseAction,
  navColor,
}: SidebarDrawerProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const scrollbar = useScrollbarVisibility();
  const scrollbarClassName = `${classes.navigationScrollbar} ${scrollbar.visible ? classes.navigationScrollbarVisible : ""}`;

  return (
    <Drawer
      opened={opened}
      onClose={onCloseAction}
      padding={0}
      position="left"
      size={300}
      title={
        <Box ps="md">
          <Anchor
            component={Link}
            href="/admin"
            underline="never"
            onClick={onCloseAction}
            aria-label="หน้าหลักผู้ดูแลระบบ"
          >
            <AdminBrand />
          </Anchor>
        </Box>
      }
      hiddenFrom="xs"
      withCloseButton={false}
      overlayProps={{ backgroundOpacity: 0.45, blur: 2 }}
      classNames={{
        body: classes.mobileDrawerBody,
        content: classes.mobileDrawerContent,
      }}
    >
      <div className={classes.mobileDrawerSidebar} data-nav-color={navColor}>
        <NavigationScrollControls
          orientation="vertical"
          viewportRef={viewportRef}
        >
          <ScrollArea
            className={classes.iconSidebarScroll}
            classNames={{
              scrollbar: scrollbarClassName,
              thumb: classes.navigationScrollbarThumb,
            }}
            onMouseEnter={scrollbar.showThenHide}
            onMouseLeave={scrollbar.hide}
            onScrollPositionChange={scrollbar.showThenHide}
            scrollbars="y"
            scrollbarSize={10}
            scrollHideDelay={500}
            type="always"
            viewportRef={viewportRef}
          >
            <Box px="md">
              <SidebarNavContent onNavigateAction={onCloseAction} />
            </Box>
          </ScrollArea>
        </NavigationScrollControls>
      </div>
    </Drawer>
  );
}
