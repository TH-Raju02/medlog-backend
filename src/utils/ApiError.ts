export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code?: string;
  public readonly errors?: unknown;
  public readonly isOperational: boolean;

  constructor(
    statusCode: number,
    message: string,
    options?: { code?: string; errors?: unknown; isOperational?: boolean }
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = options?.code;
    this.errors = options?.errors;
    this.isOperational = options?.isOperational ?? true;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}
