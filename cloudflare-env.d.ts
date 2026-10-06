declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    ADMIN_EMAILS?: string;
    SITE_ORIGIN?: string;
    INDEXING_ENABLED?: string;
  }
}
