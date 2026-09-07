"use client";

import { Center, Group, Radio, Stack, Text } from "@mantine/core";
import { setLayoutMode, setNavColor, type LayoutMode, type NavColor } from "../../features/layout/layout-slice";
import { useAppDispatch, useAppSelector } from "../../hooks";
import SettingGroup from "./setting-group";
import SettingSet from "./setting-set";
import SidebarLayoutIcon from "./icons/sidebar-layout-icon";
import IconLayoutIcon from "./icons/icon-layout-icon";
import HorizontalLayoutIcon from "./icons/horizontal-layout-icon";
import NavColorIntegrateIcon from "./icons/nav-color-integrate-icon";
import NavColorApparentIcon from "./icons/nav-color-apparent-icon";
import classes from "./navigation-group.module.css";

const layouts = [
  { value: "default", label: "แถบด้านข้างหลัก", icon: SidebarLayoutIcon },
  { value: "icon", label: "แถบไอคอนข้าง", icon: IconLayoutIcon },
  { value: "horizontal", label: "เมนูด้านบน", icon: HorizontalLayoutIcon },
] as const;

export default function NavigationGroup() {
  const dispatch = useAppDispatch();
  const { layoutMode, navColor } = useAppSelector((state) => state.layout);
  const selectedLayout = layoutMode === "compact" ? "default" : layoutMode;

  return (
    <SettingSet title="การนำทาง" information="ตั้งค่าเค้าโครงและโทนสีของแถบนำทาง">
      <Stack gap="md">
        <SettingGroup
          title="เค้าโครง"
          isDirty={selectedLayout !== "default"}
          onReset={() => dispatch(setLayoutMode("default"))}
        >
          <Radio.Group
            value={selectedLayout}
            onChange={(value) => dispatch(setLayoutMode(value as LayoutMode))}
            aria-label="เค้าโครงแถบนำทาง"
          >
            <Group gap="xs" justify="center">
              {layouts.map((option) => {
                const Icon = option.icon;
                return (
                  <Radio.Card key={option.value} value={option.value} className={classes.layoutCard}>
                    <Icon />
                  </Radio.Card>
                );
              })}
            </Group>
          </Radio.Group>
        </SettingGroup>
        <SettingGroup
          title="สีแถบนำทาง"
          isDirty={navColor !== "apparent"}
          onReset={() => dispatch(setNavColor("apparent"))}
        >
          <Radio.Group
            value={navColor}
            onChange={(value) => dispatch(setNavColor(value as NavColor))}
            aria-label="สีของแถบนำทาง"
          >
            <Group gap="sm">
              {[
                { value: "integrate", label: "กลมกลืน", icon: NavColorIntegrateIcon },
                { value: "apparent", label: "เด่นชัด", icon: NavColorApparentIcon },
              ].map((option) => {
                const Icon = option.icon;
                return (
                  <Radio.Card key={option.value} value={option.value} className={classes.navColorCard}>
                    <Center className={classes.navColorIcon}><Icon /></Center>
                    <Text component="span" size="sm" fw={600}>{option.label}</Text>
                  </Radio.Card>
                );
              })}
            </Group>
          </Radio.Group>
        </SettingGroup>
      </Stack>
    </SettingSet>
  );
}
