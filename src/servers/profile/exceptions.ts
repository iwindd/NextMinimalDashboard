export class ProfileNotFoundError extends Error {
  constructor() {
    super("ไม่พบข้อมูลโปรไฟล์");
    this.name = "ProfileNotFoundError";
  }
}

export class ProfileCurrentPasswordError extends Error {
  constructor() {
    super("รหัสผ่านเดิมไม่ถูกต้อง");
    this.name = "ProfileCurrentPasswordError";
  }
}
