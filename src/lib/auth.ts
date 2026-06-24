import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import type { NextRequest } from "next/server";
import type { AuthUser, Role } from "./types";

const JWT_SECRET = process.env.JWT_SECRET || "dev-insecure-jwt-secret-change-me";
export const AUTH_COOKIE = "atg_token";

interface TokenPayload {
  sub: string;
  email: string;
  name: string;
  role: Role;
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(user: AuthUser): string {
  const payload: TokenPayload = {
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "12h" });
}

// Reads and verifies the JWT from the request cookie. Returns null if absent or
// invalid. This is the single source of truth for the caller's identity/role;
// the LLM never participates in authentication or authorization.
export function getAuthUser(req: NextRequest): AuthUser | null {
  const token = req.cookies.get(AUTH_COOKIE)?.value;
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    return {
      id: decoded.sub,
      email: decoded.email,
      name: decoded.name,
      role: decoded.role,
    };
  } catch {
    return null;
  }
}
