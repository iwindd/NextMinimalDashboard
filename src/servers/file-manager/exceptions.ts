export class FileAuthorizationError extends Error {
  constructor() {
    super("ไม่มีสิทธิ์จัดการไฟล์");
    this.name = "FileAuthorizationError";
  }
}

export class FileValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FileValidationError";
  }
}
