import { Injectable, Inject } from '@nestjs/common';
import { eq, and, gt } from 'drizzle-orm';
import { DATABASE_CONNECTION, sessions, users } from '../database/database.module';

export interface AuthUser {
  id: string;
  email: string | null;
  name: string | null;
  image: string | null;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: any,
  ) {}

  async validateSession(sessionToken: string): Promise<AuthUser | null> {
    const result = await this.db
      .select({
        sessionToken: sessions.sessionToken,
        userId: sessions.userId,
        expires: sessions.expires,
        user: {
          id: users.id,
          email: users.email,
          name: users.name,
          image: users.image,
        },
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(
        and(
          eq(sessions.sessionToken, sessionToken),
          gt(sessions.expires, new Date())
        )
      )
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    return result[0].user;
  }

  async getUserById(userId: string): Promise<AuthUser | null> {
    const result = await this.db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        image: users.image,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return result[0] || null;
  }
}
