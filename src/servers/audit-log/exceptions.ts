export class AuditLogAuthorizationError extends Error {
  constructor() {
    super("ไม่มีสิทธิ์ดูประวัติการทำรายการ");
    this.name = "AuditLogAuthorizationError";
  }
}

export class AuditLogNotFoundError extends Error {
  constructor() {
    super("ไม่พบประวัติการทำรายการ");
    this.name = "AuditLogNotFoundError";
  }
}
