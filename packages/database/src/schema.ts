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
import type { AdapterAccountType } from 'next-auth/adapters';

// ============================================
// NextAuth Required Tables
// Note: DrizzleAdapter expects singular table names (user, account, session, verificationToken)
// ============================================

export const users = pgTable('user', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
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
    type: text('type').$type<AdapterAccountType>().notNull(),
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
  ]
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
  ]
);

// ============================================
// DMS Application Tables
// ============================================

export const folders = pgTable(
  'folder',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    parentId: text('parentId').references((): typeof folders => folders.id, {
      onDelete: 'cascade',
    }),
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
  ]
);

export const files = pgTable(
  'file',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    folderId: text('folderId').references(() => folders.id, {
      onDelete: 'cascade',
    }),
    name: text('name').notNull(),
    storageKey: text('storageKey').notNull(), // R2 path: /{userId}/{fileId}/{filename}
    mimeType: text('mimeType').notNull(),
    sizeBytes: bigint('sizeBytes', { mode: 'number' }).notNull(),
    isStarred: boolean('isStarred').default(false).notNull(),
    isDeleted: boolean('isDeleted').default(false).notNull(),
    deletedAt: timestamp('deletedAt', { mode: 'date' }),
    lastAccessedAt: timestamp('lastAccessedAt', { mode: 'date' }),
    // OCR/AI Processing fields
    ocrText: text('ocrText'), // Extracted text from OCR
    ocrSummary: text('ocrSummary'), // AI-generated summary
    ocrProcessedAt: timestamp('ocrProcessedAt', { mode: 'date' }), // When OCR was last run
    createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    index('file_userId_idx').on(table.userId),
    index('file_folderId_idx').on(table.folderId),
    index('file_isDeleted_idx').on(table.isDeleted),
    index('file_isStarred_idx').on(table.isStarred),
    index('file_lastAccessedAt_idx').on(table.lastAccessedAt),
  ]
);

// Type exports for use in application code
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Account = typeof accounts.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Folder = typeof folders.$inferSelect;
export type NewFolder = typeof folders.$inferInsert;
export type File = typeof files.$inferSelect;
export type NewFile = typeof files.$inferInsert;
