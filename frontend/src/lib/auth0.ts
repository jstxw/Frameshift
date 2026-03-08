import { Auth0Client } from "@auth0/nextjs-auth0/server";

// AUTH0_ISSUER_BASE_URL is "https://tenant.auth0.com" — strip the protocol for domain
const issuerBase = process.env.AUTH0_ISSUER_BASE_URL ?? "";
const domain = issuerBase.replace("https://", "").replace("http://", "");

export const auth0 = new Auth0Client({
  domain,
  clientId: process.env.AUTH0_CLIENT_ID!,
  clientSecret: process.env.AUTH0_CLIENT_SECRET!,
  secret: process.env.AUTH0_SECRET!,
  appBaseUrl: process.env.AUTH0_BASE_URL!,
  routes: {
    login: "/api/auth/login",
    logout: "/api/auth/logout",
    callback: "/api/auth/callback",
  },
});
