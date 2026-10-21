/**
 * Digital Asset Links: tells Android that the RamAI app (com.ramai.app) and this site belong together, so the app
 * opens the site full screen with no browser bar. The certificates are public fingerprints, not secrets: the upload
 * key's, and — once Google Play signs the app — Play's app-signing key, added in RAMAI_ANDROID_CERT_SHA256
 * (comma-separated, from Play Console → Test and release → App integrity → App signing).
 */
const UPLOAD_KEY = "57:4E:81:FA:18:4A:C6:7E:10:A8:C5:6F:CF:DB:5A:BD:BB:16:FF:ED:4A:D8:85:E9:0F:DB:73:B8:57:38:8D:9E";
/** Google Play's app-signing key — what the app installed from Play is signed with. */
const PLAY_KEY = "70:54:BB:D1:3C:44:FB:32:8A:11:C4:94:5E:59:AF:9B:6D:1B:C7:A8:34:91:77:D2:BC:13:EB:F6:D7:0B:A7:FF";

export function GET() {
  const extra = (process.env.RAMAI_ANDROID_CERT_SHA256 ?? "").split(",").map((s) => s.trim().toUpperCase()).filter((s) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(s));
  const statements = [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: { namespace: "android_app", package_name: "com.ramai.app", sha256_cert_fingerprints: [...new Set([PLAY_KEY, UPLOAD_KEY, ...extra])] },
    },
  ];
  return Response.json(statements, { headers: { "Cache-Control": "public, max-age=3600" } });
}
