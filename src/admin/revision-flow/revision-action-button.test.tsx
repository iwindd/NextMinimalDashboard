import { MantineProvider } from "@mantine/core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { adminTheme } from "@/admin/theme";
import { RevisionActionButton } from "./revision-action-button";

function renderAction(action: Parameters<typeof RevisionActionButton>[0]["action"], contentNoun?: string) {
  return renderToStaticMarkup(
    <MantineProvider theme={adminTheme}>
      <RevisionActionButton action={action} contentNoun={contentNoun} />
    </MantineProvider>,
  );
}

describe("RevisionActionButton", () => {
  it.each([
    ["save", "บันทึก", "outline", "brand"],
    ["saveAndPublish", "บันทึกและเผยแพร่", "filled", "success"],
    ["submit", "ส่งตรวจสอบ", "filled", "brand"],
    ["resubmit", "ส่งตรวจสอบอีกครั้ง", "filled", "brand"],
    ["cancelReview", "ยกเลิกการส่งตรวจสอบ", "outline", "gray"],
    ["cancelRepublish", "ยกเลิกส่งคำขอเผยแพร่อีกครั้ง", "outline", "gray"],
    ["requestRepublish", "ส่งคำขอเผยแพร่อีกครั้ง", "filled", "orange"],
    ["sendBack", "ส่งกลับให้แก้ไข", "outline", "orange"],
    ["approve", "อนุมัติและเผยแพร่", "filled", "success"],
    ["approveRepublish", "อนุมัติและเผยแพร่อีกครั้ง", "filled", "success"],
  ] as const)("renders %s with the expected Mantine props", (action, label, variant, color) => {
    const html = renderAction(action);

    expect(html).toContain(`data-variant="${variant}"`);
    expect(html).toContain(
      variant === "filled"
        ? `--button-bg:var(--mantine-color-${color}-filled)`
        : `--button-color:var(--mantine-color-${color}-outline)`,
    );
    expect(html).toContain(label);
  });

  it("uses the content noun for publish and archive labels", () => {
    expect(renderAction("publish", "สื่อการเรียนรู้")).toContain(
      "เผยแพร่สื่อการเรียนรู้",
    );
    expect(renderAction("archive", "ความรู้")).toContain("จัดเก็บความรู้");
  });
});
