import { Global, Module } from '@nestjs/common';
import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import {
  pgTable,
  text,
  timestamp,
  primaryKey,
  integer,
  bigint,
  boolean,
  index,
} from 'drizzle-orm/pg-core';

export const DATABASE_CONNECTION = 'DATABASE_CONNECTION';

// NextAuth-compatible schema (singular table names required by DrizzleAdapter)
export const users = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name'),
  email: text('email').unique(),
  emailVerified: timestamp('emailVerified', { mode: 'date' }),
  image: text('image'),
});

export const accounts = pgTable(
  'account',
  {
    userId: text('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('providerAccountId').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ],
);

export const sessions = pgTable('session', {
  sessionToken: text('sessionToken').primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
});

export const verificationTokens = pgTable(
  'verificationToken',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { mode: 'date' }).notNull(),
  },
  (verificationToken) => [
    primaryKey({
      columns: [verificationToken.identifier, verificationToken.token],
    }),
  ],
);

// DMS Application Tables
export const folders = pgTable(
  'folder',
  {
    id: text('id').primaryKey(),
    userId: text('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    parentId: text('parentId'),
    name: text('name').notNull(),
    isStarred: boolean('isStarred').default(false).notNull(),
    isDeleted: boolean('isDeleted').default(false).notNull(),
    deletedAt: timestamp('deletedAt', { mode: 'date' }),
    createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    index('folder_userId_idx').on(table.userId),
    index('folder_parentId_idx').on(table.parentId),
    index('folder_isDeleted_idx').on(table.isDeleted),
    index('folder_isStarred_idx').on(table.isStarred),
  ],
);

export const files = pgTable(
  'file',
  {
    id: text('id').primaryKey(),
    userId: text('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    folderId: text('folderId').references(() => folders.id, {
      onDelete: 'cascade',
    }),
    name: text('name').notNull(),
    storageKey: text('storageKey').notNull(),
    mimeType: text('mimeType').notNull(),
    sizeBytes: bigint('sizeBytes', { mode: 'number' }).notNull(),
    isStarred: boolean('isStarred').default(false).notNull(),
    isDeleted: boolean('isDeleted').default(false).notNull(),
    deletedAt: timestamp('deletedAt', { mode: 'date' }),
    lastAccessedAt: timestamp('lastAccessedAt', { mode: 'date' }),
    // OCR/AI Processing fields
    ocrText: text('ocrText'),
    ocrSummary: text('ocrSummary'),
    ocrProcessedAt: timestamp('ocrProcessedAt', { mode: 'date' }),
    createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    index('file_userId_idx').on(table.userId),
    index('file_folderId_idx').on(table.folderId),
    index('file_isDeleted_idx').on(table.isDeleted),
    index('file_isStarred_idx').on(table.isStarred),
    index('file_lastAccessedAt_idx').on(table.lastAccessedAt),
  ],
);

export const schema = {
  users,
  accounts,
  sessions,
  verificationTokens,
  folders,
  files,
};

// Export database type for type-safe injection
export type Database = PostgresJsDatabase<typeof schema>;

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_CONNECTION,
      useFactory: () => {
        const connectionString = process.env.DATABASE_URL;
        if (!connectionString) {
          throw new Error('DATABASE_URL is not defined');
        }
        const client = postgres(connectionString);
        return drizzle(client, { schema });
      },
    },
  ],
  exports: [DATABASE_CONNECTION],
})
export class DatabaseModule {}
