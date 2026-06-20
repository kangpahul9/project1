import { createRequire } from "module";

const { generateSecret, generateSync, verifySync, generateURI } =
  createRequire(import.meta.url)("otplib");

// Expose the same interface auth.js uses (mirrors the old otplib v12 authenticator API)
export const authenticator = {
  generateSecret: () => generateSecret(),
  keyuri: (accountName, service, secret) =>
    generateURI({ label: accountName, issuer: service, secret }),
  verify: ({ token, secret }) => {
    const result = verifySync({ token, secret });
    return typeof result === "boolean" ? result : result?.valid === true;
  },
};
