import { AuditAction, AuditResourceType } from "@prisma/client";

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  USER_CREATED: "สร้างผู้ใช้งาน", USER_STATUS_CHANGED: "เปลี่ยนสถานะผู้ใช้งาน",
  USER_EMAIL_CHANGED: "เปลี่ยนอีเมลผู้ใช้งาน", USER_NAME_CHANGED: "เปลี่ยนชื่อผู้ใช้งาน",
  USER_PASSWORD_RESET: "รีเซ็ตรหัสผ่านผู้ใช้งาน", USER_ROLE_CHANGED: "เปลี่ยนบทบาทผู้ใช้งาน",
  PROFILE_NAME_CHANGED: "แก้ชื่อบัญชีของตัวเอง", PROFILE_EMAIL_CHANGED: "แก้อีเมลบัญชีของตัวเอง",
  PROFILE_PASSWORD_CHANGED: "เปลี่ยนรหัสผ่านของตัวเอง", LOGIN_SUCCEEDED: "เข้าสู่ระบบสำเร็จ",
  LOGIN_FAILED: "เข้าสู่ระบบไม่สำเร็จ", NEWS_CREATED: "สร้างข่าว", NEWS_UPDATED: "แก้ไขข่าว",
  NEWS_SUBMITTED: "ส่งข่าวให้ตรวจ", NEWS_CHANGES_REQUESTED: "ขอแก้ไขข่าว",
  NEWS_PUBLISHED: "เผยแพร่ข่าว", NEWS_ARCHIVED: "จัดเก็บข่าว", NEWS_DELETED: "ลบข่าว",
  NEWS_RESTORED: "กู้คืนข่าว", NEWS_CATEGORY_CREATED: "สร้างหมวดหมู่ข่าว",
  FILE_UPLOADED: "อัปโหลดไฟล์", FILE_DELETED: "ลบไฟล์ออกจากระบบถาวร",
  NEWS_MEDIA_ATTACHED: "แนบไฟล์กับข่าว", NEWS_MEDIA_DETACHED: "ถอดไฟล์ออกจากข่าว",
  AUDIT_LOG_EXPORTED: "ดาวน์โหลดประวัติการทำรายการ",
};

export const AUDIT_RESOURCE_TYPE_LABELS: Record<AuditResourceType, string> = {
  USER: "ผู้ใช้งาน", PROFILE: "บัญชีของตัวเอง", NEWS: "ข่าว",
  NEWS_CATEGORY: "หมวดหมู่ข่าว", FILE: "ไฟล์", AUDIT_LOG: "ประวัติการทำรายการ",
};

const ACCOUNT_GROUP = "บัญชีและการเข้าระบบ";
const MEDIA_GROUP = "ไฟล์และสื่อ";

function toActionGroup(action: AuditAction) {
  if (action.startsWith("USER_") || action.startsWith("PROFILE_") || action.startsWith("LOGIN_")) return ACCOUNT_GROUP;
  if (action.includes("_MEDIA_") || action.startsWith("FILE_")) return MEDIA_GROUP;
  if (action.startsWith("NEWS_")) return AUDIT_RESOURCE_TYPE_LABELS.NEWS;
  return AUDIT_RESOURCE_TYPE_LABELS.AUDIT_LOG;
}

export const AUDIT_ACTION_GROUPS = Object.values(AuditAction).reduce<
  { group: string; items: { value: string; label: string }[] }[]
>((groups, action) => {
  const groupLabel = toActionGroup(action);
  const group = groups.find((candidate) => candidate.group === groupLabel);
  const item = { value: action, label: AUDIT_ACTION_LABELS[action] };
  if (group) group.items.push(item); else groups.push({ group: groupLabel, items: [item] });
  return groups;
}, []);

export const AUDIT_RESOURCE_TYPE_OPTIONS = Object.values(AuditResourceType).map((resourceType) => ({
  value: resourceType, label: AUDIT_RESOURCE_TYPE_LABELS[resourceType],
}));

export const AUDIT_ACTOR_ROLE_LABELS = { ADMIN: "ผู้ดูแลระบบ", EDITOR: "ผู้แก้ไข" } as const;
