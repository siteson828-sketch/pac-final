import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import bcrypt from 'bcryptjs';
import { db, ensureAuthTables, getUserByEmail, upsertGoogleUser, getTierForUser } from '../../../lib/authdb';

// Email/password login. NextAuth's Credentials provider ONLY supports the JWT
// session strategy (documented limitation), which is why the whole config uses
// JWT sessions — while users, hashes, and tiers still live in Neon.
const providers = [
  CredentialsProvider({
    name: 'Email',
    credentials: {
      email: { label: 'Email', type: 'email' },
      password: { label: 'Password', type: 'password' },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) return null;
      const sql = db();
      await ensureAuthTables(sql);
      const user = await getUserByEmail(sql, credentials.email.toLowerCase().trim());
      if (!user || !user.password_hash) return null;
      const ok = await bcrypt.compare(credentials.password, user.password_hash);
      if (!ok) return null;
      return { id: String(user.id), email: user.email, name: user.name || null, image: user.image || null };
    },
  }),
];

// Google is optional — only registered when its keys exist, so a missing
// GOOGLE_CLIENT_ID/SECRET can't 500 the auth route or block email login.
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(GoogleProvider({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  }));
}

export const authOptions = {
  providers,
  session: { strategy: 'jwt' }, // required for the Credentials provider
  secret: process.env.NEXTAUTH_SECRET,
  pages: { signIn: '/sign-in' },
  callbacks: {
    async signIn({ user, account, profile }) {
      // Persist Google users into Neon so they get a stable local id + tier row.
      if (account?.provider === 'google') {
        try {
          const sql = db();
          await ensureAuthTables(sql);
          const local = await upsertGoogleUser(sql, {
            email: (user.email || profile?.email || '').toLowerCase(),
            name: user.name || profile?.name || null,
            image: user.image || null,
            googleId: account.providerAccountId,
          });
          user.id = String(local.id);
        } catch (e) {
          console.error('google signIn upsert failed:', e.message);
          return false;
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      // `user` is only present on initial sign in — capture id + tier snapshot
      // then. (Gating endpoints re-read the tier from the DB, so this is a hint.)
      if (user?.id) {
        token.uid = user.id;
        try {
          const sql = db();
          token.tier = await getTierForUser(sql, user.id);
        } catch (e) {
          token.tier = 'free';
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid || null;
        session.user.tier = token.tier || 'free';
      }
      return session;
    },
  },
};

export default NextAuth(authOptions);
