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
import classes from "./icon-sidebar.module.css";
import NavigationScrollControls from "./navigation-scroll-controls";
import {
  checkActiveChildren,
  getLinkHref,
  getNavItems,
  getNotificationCount,
  formatNotificationCount,
  isLinkItem,
  isParentItem,
  useFilteredNavGroups,
  useIsRouteActive,
  useNotifications,
  type NavItem,
} from "./navigation-utils";
import { useScrollbarVisibility } from "./use-scrollbar-visibility";

export default function IconSidebar() {
  const notifications = useNotifications();
  const viewportRef = useRef<HTMLDivElement>(null);
  const scrollbar = useScrollbarVisibility();
  const scrollbarClassName = `${classes.navigationScrollbar} ${scrollbar.visible ? classes.navigationScrollbarVisible : ""}`;
  const groups = useFilteredNavGroups();
  const allItems = getNavItems(groups);
  const isActiveRoute = useIsRouteActive();

  const renderMenuMeta = (item: NavItem) => {
    const notificationCount = getNotificationCount(
      notifications,
      item.notification,
    );

    if (notificationCount === 0 && !item.badge && !item.info) return null;

    return (
      <Group gap={6} wrap="nowrap">
        {item.info && (
          <Tooltip label={item.info} withArrow>
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
        {item.badge && item.badge.label && (
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

  const renderTooltipLabel = (item: NavItem) => {
    const notificationCount = getNotificationCount(
      notifications,
      item.notification,
    );

    if (notificationCount === 0 && !item.badge && !item.info) {
      return item.label;
    }

    return (
      <Stack gap={4} align="flex-start">
        <Group gap={6} wrap="nowrap">
          <Text size="xs" fw={600} c="inherit">
            {item.label}
          </Text>
          {notificationCount > 0 && (
            <Badge variant="light" size="xs" circle>
              {notificationCount}
            </Badge>
          )}
          {item.badge && item.badge.label && (
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
        {item.info && (
          <Text size="xs" c="inherit" opacity={0.85}>
            {item.info}
          </Text>
        )}
      </Stack>
    );
  };

  const renderMenuItems = (items: NavItem[]) => {
    return items.map((item) => {
      const hasChildren = isParentItem(item);
      const menuMeta = renderMenuMeta(item);
      const IconComponent = item.icon;
      const icon = IconComponent ? (
        <IconComponent size={16} stroke={1.8} />
      ) : undefined;

      if (hasChildren && item.items) {
        return (
          <Menu.Sub key={item.label} openDelay={100} closeDelay={100}>
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
            key={item.label}
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
          key={item.label}
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
  };

  return (
    <aside className={classes.iconSidebar}>
      <Group gap={0} justify="center" w="100%" pb="md">
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
            gap="4"
            align="center"
            pb="xl"
          >
            {allItems.map((item) => {
              const hasChildren = isParentItem(item);
              const isSelfActive = isLinkItem(item)
                ? isActiveRoute(item.routeName)
                : false;
              const isChildActive = hasChildren
                ? checkActiveChildren(item.items ?? [], isActiveRoute)
                : false;
              const isActive = isSelfActive || isChildActive;
              const IconComponent = item.icon;
              const menuMeta = renderMenuMeta(item);
              const tooltipLabel = renderTooltipLabel(item);

              if (!IconComponent) return null;

              if (hasChildren && item.items) {
                return (
                  <Menu
                    key={item.label}
                    trigger="click-hover"
                    closeOnItemClick={true}
                    openDelay={100}
                    closeDelay={100}
                    position="right-start"
                    shadow="md"
                    width={200}
                    offset={12}
                  >
                    <Menu.Target>
                      <button
                        aria-label={item.label}
                        className={classes.iconSidebarItem}
                        data-active={isActive}
                        disabled={item.disabled}
                      >
                        <IconComponent size={22} stroke={1.8} />
                        <IconChevronRight
                          size={14}
                          stroke={2}
                          className={classes.iconSidebarChevron}
                        />
                      </button>
                    </Menu.Target>
                    <Menu.Dropdown className={classes.horizontalMenuDropdown}>
                      <Menu.Label>
                        <Group justify="space-between" gap={8} wrap="nowrap">
                          <span>{item.label}</span>
                          {menuMeta}
                        </Group>
                      </Menu.Label>
                      {renderMenuItems(item.items)}
                    </Menu.Dropdown>
                  </Menu>
                );
              }

              if (!isLinkItem(item)) {
                return (
                  <Tooltip
                    key={item.label}
                    label={tooltipLabel}
                    position="right"
                    multiline
                    withArrow
                    offset={12}
                  >
                    <span>
                      <button
                        aria-label={item.label}
                        className={classes.iconSidebarItem}
                        data-disabled={true}
                        disabled={true}
                      >
                        <IconComponent size={22} stroke={1.8} />
                      </button>
                    </span>
                  </Tooltip>
                );
              }

              return (
                <Tooltip
                  key={item.label}
                  label={tooltipLabel}
                  position="right"
                  multiline
                  withArrow
                  offset={12}
                >
                  <Anchor
                    aria-label={item.label}
                    component={Link}
                    href={getLinkHref(item)}
                    className={classes.iconSidebarItem}
                    data-active={isSelfActive}
                    aria-current={isSelfActive ? "page" : undefined}
                    underline="never"
                  >
                    <IconComponent size={22} stroke={1.8} />
                  </Anchor>
                </Tooltip>
              );
            })}
          </Stack>
        </ScrollArea>
      </NavigationScrollControls>
    </aside>
  );
}
