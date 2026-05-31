import { z } from "zod";
import { ShelfError } from "./error";
import { isBrowser } from "./is-browser";

declare global {
  interface Window {
    env: {
      NODE_ENV: "development" | "production" | "test";
      MAPTILER_TOKEN: string;
      MICROSOFT_CLARITY_ID: string;
      CRISP_WEBSITE_ID: string;
      CLOUDFLARE_WEB_ANALYTICS_TOKEN: string;
      ENABLE_PREMIUM_FEATURES: string;
      MAINTENANCE_MODE: string;
      CHROME_EXECUTABLE_PATH: string;
      URL_SHORTENER: string;
      SENTRY_DSN: string;
      SUPPORT_EMAIL: string;
      FULL_CALENDAR_LICENSE_KEY: string;
      SHOW_HOW_DID_YOU_FIND_US: string;
      COLLECT_BUSINESS_INTEL: string;
    };
  }
}

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: "development" | "production" | "test";
      SERVER_URL: string;
      URL_SHORTENER: string;
      SESSION_SECRET: string;
      MAPTILER_TOKEN: string;
      CRISP_WEBSITE_ID: string;
      MICROSOFT_CLARITY_ID: string;
      CLOUDFLARE_WEB_ANALYTICS_TOKEN: string;
      ENABLE_PREMIUM_FEATURES: string;
      DISABLE_SIGNUP: string;
      INVITE_TOKEN_SECRET: string;
      RELAY_API_KEY: string;
      RELAY_SMTP_KEY: string;
      MAINTENANCE_MODE: string;
      DATABASE_URL: string;
      DATABASE_AUTH_TOKEN: string;
      SENTRY_DSN: string;
      ADMIN_EMAIL: string;
      CHROME_EXECUTABLE_PATH: string;
      FINGERPRINT: string;
      SUPPORT_EMAIL: string;
      FULL_CALENDAR_LICENSE_KEY: string;
      SHOW_HOW_DID_YOU_FIND_US: string;
      COLLECT_BUSINESS_INTEL: string;
      COOKIE_DOMAIN: string;
      SEND_ONBOARDING_EMAIL: string;
    }
  }
}

type EnvOptions = {
  isSecret?: boolean;
  isRequired?: boolean;
  allowEmpty?: boolean;
};

export function getEnv<K extends keyof NodeJS.ProcessEnv>(
  name: K,
  { isRequired = true, isSecret = true, allowEmpty = false }: EnvOptions = {}
): NodeJS.ProcessEnv[K] {
  if (isBrowser && isSecret) return "";

  const source = (isBrowser ? window.env : process.env) ?? {};

  const value = (source as NodeJS.ProcessEnv)[name];

  if (allowEmpty) {
    if ((value === undefined || value === null) && isRequired) {
      throw new ShelfError({
        message: `${name} is not set`,
        cause: null,
        label: "Environment",
      });
    }
  } else {
    if (!value && isRequired) {
      throw new ShelfError({
        message: `${name} is not set`,
        cause: null,
        label: "Environment",
      });
    }
  }

  return value as NodeJS.ProcessEnv[K] | undefined;
}

export const EnvSchema = z.object({
  SESSION_SECRET: z.string().min(1),
  NODE_ENV: z.enum(["development", "production", "test"]),
});

type Env = z.infer<typeof EnvSchema>;

const PublicEnvSchema = EnvSchema.pick({
  NODE_ENV: true,
});

export const env = (
  isBrowser ? PublicEnvSchema.parse(window.env) : EnvSchema.parse(process.env)
) as Env;

export function initEnv() {
  return env;
}

/**
 * Server env
 */
export const SERVER_URL = getEnv("SERVER_URL").replace(/\/+$/, "");
export const INVITE_TOKEN_SECRET = getEnv("INVITE_TOKEN_SECRET", {
  isSecret: true,
});
export const URL_SHORTENER = getEnv("URL_SHORTENER", {
  isRequired: false,
});

export const COOKIE_DOMAIN =
  getEnv("COOKIE_DOMAIN", {
    isSecret: false,
    isRequired: false,
  })?.trim() || undefined;

export const SESSION_SECRET = getEnv("SESSION_SECRET");
export const FINGERPRINT = getEnv("FINGERPRINT", {
  isSecret: true,
  isRequired: false,
});

/** Relay email service credentials */
export const RELAY_API_KEY =
  getEnv("RELAY_API_KEY", {
    isSecret: true,
    isRequired: false,
  }) || "";
export const RELAY_SMTP_KEY =
  getEnv("RELAY_SMTP_KEY", {
    isSecret: true,
    isRequired: false,
  }) || "";

export const SMTP_FROM =
  getEnv("SMTP_FROM", {
    isRequired: false,
  }) || "";

export const DATABASE_URL = getEnv("DATABASE_URL");
export const DATABASE_AUTH_TOKEN =
  getEnv("DATABASE_AUTH_TOKEN", {
    isRequired: false,
    allowEmpty: true,
  }) || "";

export const SENTRY_DSN = getEnv("SENTRY_DSN", {
  isSecret: false,
  isRequired: false,
});

export const ADMIN_EMAIL = getEnv("ADMIN_EMAIL", {
  isRequired: false,
});

export const CUSTOM_INSTALL_CUSTOMERS = getEnv("CUSTOM_INSTALL_CUSTOMERS", {
  isRequired: false,
});

/**
 * Shared envs
 */
export const NODE_ENV = getEnv("NODE_ENV", {
  isSecret: false,
  isRequired: false,
});
export const MAPTILER_TOKEN =
  getEnv("MAPTILER_TOKEN", {
    isSecret: false,
    isRequired: false,
  }) || "";
export const CRISP_WEBSITE_ID = getEnv("CRISP_WEBSITE_ID", {
  isSecret: false,
  isRequired: false,
});
export const MICROSOFT_CLARITY_ID = getEnv("MICROSOFT_CLARITY_ID", {
  isSecret: false,
  isRequired: false,
});
export const CLOUDFLARE_WEB_ANALYTICS_TOKEN = getEnv(
  "CLOUDFLARE_WEB_ANALYTICS_TOKEN",
  {
    isSecret: false,
    isRequired: false,
  }
);
export const FORMBRICKS_ENV_ID = getEnv("FORMBRICKS_ENV_ID", {
  isSecret: false,
  isRequired: false,
});

export const SUPPORT_EMAIL = getEnv("SUPPORT_EMAIL", {
  isSecret: false,
  isRequired: false,
});

export const GEOCODING_USER_AGENT = getEnv("GEOCODING_USER_AGENT", {
  isSecret: false,
  isRequired: false,
});

export const FULL_CALENDAR_LICENSE_KEY = getEnv("FULL_CALENDAR_LICENSE_KEY", {
  isSecret: false,
  isRequired: false,
});

export const MAINTENANCE_MODE =
  getEnv("MAINTENANCE_MODE", {
    isSecret: false,
    isRequired: false,
  }) === "true" || false;

// Always false in self-hosted mode — all features are available
export const ENABLE_PREMIUM_FEATURES = false;

export const SHOW_HOW_DID_YOU_FIND_US =
  getEnv("SHOW_HOW_DID_YOU_FIND_US", {
    isSecret: false,
    isRequired: false,
  }) === "true" || false;

export const COLLECT_BUSINESS_INTEL =
  getEnv("COLLECT_BUSINESS_INTEL", {
    isSecret: false,
    isRequired: false,
  }) === "true" || false;

export const DISABLE_SIGNUP =
  getEnv("DISABLE_SIGNUP", {
    isSecret: false,
    isRequired: false,
  }) === "true" || false;

export const SEND_ONBOARDING_EMAIL =
  getEnv("SEND_ONBOARDING_EMAIL", {
    isSecret: false,
    isRequired: false,
  }) === "true" || false;

export const CHROME_EXECUTABLE_PATH = getEnv("CHROME_EXECUTABLE_PATH", {
  isSecret: false,
  isRequired: false,
});

/** Storage driver: "local" (default) or "s3" */
export const STORAGE_DRIVER =
  getEnv("STORAGE_DRIVER", { isSecret: false, isRequired: false }) || "local";

/** Root directory for local file uploads (used when STORAGE_DRIVER=local). */
export const UPLOAD_DIR =
  getEnv("UPLOAD_DIR", { isSecret: false, isRequired: false }) ||
  "/data/uploads";

/** S3-compatible storage configuration (used when STORAGE_DRIVER=s3). */
export const S3_ENDPOINT = getEnv("S3_ENDPOINT", {
  isSecret: true,
  isRequired: false,
});
export const S3_BUCKET = getEnv("S3_BUCKET", {
  isSecret: false,
  isRequired: false,
});
export const S3_ACCESS_KEY_ID = getEnv("S3_ACCESS_KEY_ID", {
  isSecret: true,
  isRequired: false,
});
export const S3_SECRET_ACCESS_KEY = getEnv("S3_SECRET_ACCESS_KEY", {
  isSecret: true,
  isRequired: false,
});
export const S3_REGION = getEnv("S3_REGION", {
  isSecret: false,
  isRequired: false,
});
export const S3_PUBLIC_URL = getEnv("S3_PUBLIC_URL", {
  isSecret: false,
  isRequired: false,
});
export const S3_FORCE_PATH_STYLE =
  getEnv("S3_FORCE_PATH_STYLE", { isSecret: false, isRequired: false }) ===
  "true";

export function getBrowserEnv() {
  return {
    NODE_ENV,
    MAPTILER_TOKEN,
    CRISP_WEBSITE_ID,
    MICROSOFT_CLARITY_ID,
    CLOUDFLARE_WEB_ANALYTICS_TOKEN,
    ENABLE_PREMIUM_FEATURES: String(ENABLE_PREMIUM_FEATURES),
    MAINTENANCE_MODE: String(MAINTENANCE_MODE),
    CHROME_EXECUTABLE_PATH,
    URL_SHORTENER,
    SUPPORT_EMAIL,
    FULL_CALENDAR_LICENSE_KEY,
    SENTRY_DSN,
    SHOW_HOW_DID_YOU_FIND_US: String(SHOW_HOW_DID_YOU_FIND_US),
    COLLECT_BUSINESS_INTEL: String(COLLECT_BUSINESS_INTEL),
  };
}
