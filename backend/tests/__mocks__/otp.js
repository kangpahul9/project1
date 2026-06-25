// Jest mock for src/utils/otp.js — avoids loading otplib's ESM deps in tests
module.exports = {
  authenticator: {
    generateSecret: () => "TESTSECRETBASE32VALUE",
    keyuri: (user, service, secret) =>
      `otpauth://totp/${encodeURIComponent(service)}:${encodeURIComponent(user)}?secret=${secret}&issuer=${encodeURIComponent(service)}`,
    verify: ({ token }) => token === "123456",
  },
};
