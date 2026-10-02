/** Lỗi nghiệp vụ, kèm mã HTTP và câu thông báo tiếng Việt hiển thị cho người dùng. */
export class AppError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const badRequest = (message: string) => new AppError(400, message);
export const notFound = (message = 'Không tìm thấy.') => new AppError(404, message);
export const tooMany = (message: string) => new AppError(429, message);
