import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { ForbiddenError } from "@shared/_core/errors";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify, createRemoteJWKSet } from "jose";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";

export type SessionPayload = {
  userId: number;
};

class SDKServer {
  private getSessionSecret(): Uint8Array {
    const secret = ENV.cookieSecret || "default_auth_secret_change_me_in_production";
    return new TextEncoder().encode(secret);
  }

  private parseCookies(cookieHeader: string | undefined): Map<string, string> {
    const cookies = new Map<string, string>();
    if (!cookieHeader) return cookies;
    try {
      const parsed = parseCookieHeader(cookieHeader);
      for (const [key, value] of Object.entries(parsed)) {
        cookies.set(key, value);
      }
    } catch (e) {
      console.warn("[Auth] Failed to parse cookies", e);
    }
    return cookies;
  }

  async createSessionToken(userId: number): Promise<string> {
    const secretKey = this.getSessionSecret();
    const payload: SessionPayload = { userId };

    return await new SignJWT(payload)
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("30d")
      .sign(secretKey);
  }

  async verifySession(
    cookieValue: string | undefined | null
  ): Promise<SessionPayload | null> {
    if (!cookieValue) {
      return null;
    }

    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"],
      });
      const { userId } = payload as Record<string, unknown>;

      if (typeof userId !== "number") {
        console.warn("[Auth] Session payload missing userId");
        return null;
      }

      return { userId };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }

  private jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

  private getJWKS() {
    if (!this.jwks && ENV.auth0Domain) {
      this.jwks = createRemoteJWKSet(new URL(`https://${ENV.auth0Domain}/.well-known/jwks.json`));
    }
    return this.jwks;
  }

  async verifyAuth0Token(token: string): Promise<User | null> {
    const JWKS = this.getJWKS();
    if (!JWKS) return null;

    try {
      const { payload } = await jwtVerify(token, JWKS, {
        issuer: ENV.auth0Issuer || `https://${ENV.auth0Domain}/`,
        audience: ENV.auth0Audience,
      });

      const sub = payload.sub;
      if (!sub) return null;

      // Check if user exists in DB by openId (Auth0 'sub')
      let user = await db.getUserByOpenId(sub);

      if (!user) {
        const email = payload.email as string | undefined;
        if (email) {
          user = await db.getUserByEmail(email);
        }

        if (user) {
          // Link existing user to Auth0 openId
          await db.updateUser(user.id, { openId: sub });
        } else {
          // Auto-provision new user
          const name = (payload.name || payload.nickname || email?.split('@')[0] || 'User') as string;
          const [newUser] = await db.createUser({
            openId: sub,
            username: (payload.nickname || sub.split('|').pop() || 'user_' + Math.random().toString(36).slice(2, 7)) as string,
            name,
            email: email || null,
            role: "user",
          }) as any;
          user = newUser;
        }
      }

      return user || null;
    } catch (error) {
      console.warn("[Auth] Auth0 token verification failed", String(error));
      return null;
    }
  }

  async authenticateRequest(req: Request): Promise<User> {
    // 1. Try Authorization header first (Auth0)
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const user = await this.verifyAuth0Token(token);
      if (user) return user;
    }

    // 2. Fallback to session cookie (Legacy/Developer)
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);
    const session = await this.verifySession(sessionCookie);

    if (!session) {
      throw ForbiddenError("Invalid session cookie or token");
    }

    const user = await db.getUserById(session.userId);

    if (!user) {
      throw ForbiddenError("User not found");
    }

    return user;
  }
}

export const sdk = new SDKServer();
