export class UserNotFoundError extends Error {
  constructor() {
    super("ไม่พบผู้ใช้งาน");
    this.name = "UserNotFoundError";
  }
}

export class UserPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserPolicyError";
  }
}

export class UserAuthorizationError extends Error {
  constructor() {
    super("ไม่มีสิทธิ์จัดการผู้ใช้งาน");
    this.name = "UserAuthorizationError";
  }
}
