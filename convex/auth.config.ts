const googleIssuer = "https://accounts.google.com";
const appleIssuer = "https://appleid.apple.com";

const rawGoogleAppIds = process.env.GOOGLE_OIDC_CLIENT_IDS ?? "";
const googleApplicationIDs = rawGoogleAppIds
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

if (googleApplicationIDs.length === 0) {
  throw new Error(
    "Missing GOOGLE_OIDC_CLIENT_IDS environment variable required for Convex auth (comma separated list)."
  );
}

const appleApplicationID = process.env.APPLE_OIDC_CLIENT_ID;

if (!appleApplicationID) {
  throw new Error(
    "Missing APPLE_OIDC_CLIENT_ID environment variable required for Convex auth."
  );
}

export default {
  providers: [
    ...googleApplicationIDs.map((applicationID) => ({
      domain: googleIssuer,
      applicationID,
    })),
    {
      domain: appleIssuer,
      applicationID: appleApplicationID,
    },
  ],
};
