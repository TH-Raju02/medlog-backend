import { Role } from "../constants/permissions";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: Role;
        email: string;
      };
    }
  }
}

export {};
