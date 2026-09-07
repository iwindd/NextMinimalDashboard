export class NewsAuthorizationError extends Error {
  constructor(message = "ไม่มีสิทธิ์จัดการข่าวสาร") {
    super(message);
    this.name = "NewsAuthorizationError";
  }
}

export class NewsNotFoundError extends Error {
  constructor() {
    super("ไม่พบข่าวสาร");
    this.name = "NewsNotFoundError";
  }
}

export class NewsPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NewsPolicyError";
  }
}

export class NewsReviewValidationError extends Error {
  fieldErrors: Record<string, string>;

  constructor(fieldErrors: Record<string, string>) {
    super("กรุณากรอกข้อมูลที่จำเป็นให้ครบก่อนส่งตรวจ");
    this.name = "NewsReviewValidationError";
    this.fieldErrors = fieldErrors;
  }
}
