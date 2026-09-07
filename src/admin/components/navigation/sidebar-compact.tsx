"use client";

import {
  Anchor,
  Badge,
  Group,
  Menu,
  ScrollArea,
  Stack,
  Text,
  Tooltip,
} from "@mantine/core";
import { IconChevronRight, IconInfoCircle } from "@tabler/icons-react";
import Link from "next/link";
import { useRef } from "react";
import { AdminBrand } from "../admin-brand";
import NavigationScrollControls from "./navigation-scroll-controls";
import {
  checkActiveChildren,
  formatNotificationCount,
  getLinkHref,
  getNavItems,
  getNotificationCount,
  isLinkItem,
  isParentItem,
  useFilteredNavGroups,
  useIsRouteActive,
  useNotifications,
  type NavItem,
} from "./navigation-utils";
import classes from "./sidebar-compact.module.css";
import { useScrollbarVisibility } from "./use-scrollbar-visibility";

export default function SidebarCompact() {
  const notifications = useNotifications();
  const viewportRef = useRef<HTMLDivElement>(null);
  const scrollbar = useScrollbarVisibility();
  const scrollbarClassName = `${classes.navigationScrollbar} ${scrollbar.visible ? classes.navigationScrollbarVisible : ""}`;
  const isActiveRoute = useIsRouteActive();
  const allItems = getNavItems(useFilteredNavGroups());

  const renderItemMeta = (item: NavItem, compact = false) => {
    const notificationCount = getNotificationCount(
      notifications,
      item.notification,
    );

    if (notificationCount === 0 && !item.badge && !item.info) {
      return null;
    }

    if (compact) {
      return (
        <>
          {item.info && (
            <Tooltip label={item.info} position="right" withArrow>
              <span className={classes.compactInfoIcon} aria-label={item.info}>
                <IconInfoCircle size={14} stroke={2} />
              </span>
            </Tooltip>
          )}
          {(notificationCount > 0 || item.badge) && (
            <Group gap={4} wrap="nowrap" className={classes.compactItemMeta}>
              {notificationCount > 0 && (
                <Badge variant="light" size="xs" circle>
                  {formatNotificationCount(notificationCount)}
                </Badge>
              )}
              {item.badge && (
                <Badge
                  color={item.badge.color ?? "cyan"}
                  variant="light"
                  size="xs"
                  className={classes.badge}
                >
                  {item.badge.label}
                </Badge>
              )}
            </Group>
          )}
        </>
      );
    }

    return (
      <Group gap={4} wrap="nowrap">
        {item.info && (
          <Tooltip label={item.info} position="top" withArrow>
            <span className={classes.menuInfoIcon} aria-label={item.info}>
              <IconInfoCircle size={13} stroke={2} />
            </span>
          </Tooltip>
        )}
        {notificationCount > 0 && (
          <Badge variant="light" size="sm" circle>
            {formatNotificationCount(notificationCount)}
          </Badge>
        )}
        {item.badge && (
          <Badge
            color={item.badge.color ?? "cyan"}
            variant="light"
            size="xs"
            className={classes.badge}
          >
            {item.badge.label}
          </Badge>
        )}
      </Group>
    );
  };

  const renderMenuItems = (items: NavItem[]) =>
    items.map((item) => {
      const hasChildren = isParentItem(item);
      const menuMeta = renderItemMeta(item);
      const IconComponent = item.icon;
      const icon = IconComponent ? (
        <IconComponent size={16} stroke={1.8} />
      ) : undefined;

      if (hasChildren) {
        return (
          <Menu.Sub key={item.id} openDelay={100} closeDelay={100}>
            <Menu.Sub.Target>
              <Menu.Sub.Item
                disabled={item.disabled}
                leftSection={icon}
                rightSection={
                  <Group gap={6} wrap="nowrap">
                    {menuMeta}
                    <IconChevronRight size={14} stroke={1.8} />
                  </Group>
                }
              >
                {item.label}
              </Menu.Sub.Item>
            </Menu.Sub.Target>
            <Menu.Sub.Dropdown className={classes.horizontalMenuDropdown}>
              {renderMenuItems(item.items)}
            </Menu.Sub.Dropdown>
          </Menu.Sub>
        );
      }

      if (!isLinkItem(item)) {
        return (
          <Menu.Item
            key={item.id}
            leftSection={icon}
            rightSection={menuMeta}
            disabled
          >
            {item.label}
          </Menu.Item>
        );
      }

      const active = isActiveRoute(item.routeName);

      return (
        <Menu.Item
          key={item.id}
          component={Link}
          href={getLinkHref(item)}
          className={active ? classes.menuItemActive : undefined}
          data-active={active}
          aria-current={active ? "page" : undefined}
          leftSection={icon}
          rightSection={menuMeta}
        >
          {item.label}
        </Menu.Item>
      );
    });

  return (
    <aside className={classes.compactSidebar}>
      <Group gap={0} justify="center" w="100%" pb="xs">
        <Anchor
          component={Link}
          href="/admin"
          underline="never"
          aria-label="หน้าหลักผู้ดูแลระบบ"
        >
          <AdminBrand compact />
        </Anchor>
      </Group>

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
          scrollbarSize={0}
          scrollHideDelay={500}
          type="always"
          viewportRef={viewportRef}
        >
          <Stack
            className={classes.sidebarScrollContent}
            gap={4}
            align="center"
            pb="xl"
          >
            {allItems.map((item) => {
              const hasChildren = isParentItem(item);
              const isSelfActive = isLinkItem(item)
                ? isActiveRoute(item.routeName)
                : false;
              const isChildActive = hasChildren
                ? checkActiveChildren(item.items, isActiveRoute)
                : false;
              const isActive = isSelfActive || isChildActive;
              const IconComponent = item.icon;
              const itemMeta = renderItemMeta(item, true);

              if (!IconComponent) {
                return null;
              }

              if (hasChildren) {
                return (
                  <Menu
                    key={item.id}
                    trigger="click-hover"
                    closeOnItemClick
                    openDelay={100}
                    closeDelay={100}
                    position="right-start"
                    shadow="md"
                    width={220}
                    offset={12}
                  >
                    <Menu.Target>
                      <button
                        type="button"
                        aria-label={item.label}
                        className={classes.compactSidebarItem}
                        data-active={isActive}
                        data-disabled={item.disabled || undefined}
                        disabled={item.disabled}
                      >
                        <IconComponent size={24} stroke={1.8} />
                        <Text
                          className={classes.compactSidebarLabel}
                          fw={600}
                          size="xs"
                        >
                          {item.label}
                        </Text>
                        {itemMeta}
                        <IconChevronRight
                          size={12}
                          stroke={1.8}
                          style={{
                            position: "absolute",
                            right: 4,
                            top: "50%",
                            transform: "translateY(-50%)",
                            opacity: 0.6,
                          }}
                        />
                      </button>
                    </Menu.Target>
                    <Menu.Dropdown className={classes.horizontalMenuDropdown}>
                      {renderMenuItems(item.items)}
                    </Menu.Dropdown>
                  </Menu>
                );
              }

              if (!isLinkItem(item)) {
                return (
                  <button
                    type="button"
                    key={item.id}
                    aria-label={`${item.label} ยังไม่เปิดใช้งาน`}
                    className={classes.compactSidebarItem}
                    data-disabled
                    disabled
                  >
                    <IconComponent size={24} stroke={1.8} />
                    <Text
                      className={classes.compactSidebarLabel}
                      fw={600}
                      size="xs"
                    >
                      {item.label}
                    </Text>
                    {itemMeta}
                  </button>
                );
              }

              return (
                <Anchor
                  key={item.id}
                  component={Link}
                  href={getLinkHref(item)}
                  className={classes.compactSidebarItem}
                  data-active={isSelfActive}
                  aria-current={isSelfActive ? "page" : undefined}
                  underline="never"
                >
                  <IconComponent size={24} stroke={1.8} />
                  <Text
                    className={classes.compactSidebarLabel}
                    fw={600}
                    size="xs"
                  >
                    {item.label}
                  </Text>
                  {itemMeta}
                </Anchor>
              );
            })}
          </Stack>
        </ScrollArea>
      </NavigationScrollControls>
    </aside>
  );
}
