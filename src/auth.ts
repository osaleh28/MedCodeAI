import NextAuth, { AuthError } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { getDb } from "@/lib/db";
import { loginSchema } from "@/lib/validation";
import { allowAuthAttempt } from "@/lib/throttle";

// A valid bcrypt hash keeps nonexistent-account checks computationally similar.
const dummyHash = "$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW";

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Auth.js's default error logger can include nested database exceptions.
  // Keep authentication diagnostics categorical and credentials out of logs.
  logger: {
    error(error) { console.error("[auth] Authentication failed", { category: error instanceof AuthError ? error.type : "UnknownError" }); },
  },
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  pages: { signIn: "/login" },
  providers: [Credentials({
    credentials: { email: { type: "email" }, password: { type: "password" } },
    async authorize(credentials) {
      const parsed = loginSchema.safeParse(credentials);
      if (!parsed.success) return null;
      const { email, password } = parsed.data;
      if (!(await allowAuthAttempt(email, "login"))) return null;
      const user = await getDb().user.findUnique({ where: { email } });
      const valid = await compare(password, user?.passwordHash ?? dummyHash);
      if (!user || !valid) return null;
      return { id: user.id, name: user.name, email: user.email };
    },
  })],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
