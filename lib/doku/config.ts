export type DokuEnvironment = "sandbox" | "production";

export type DokuConfig = {
  environment: DokuEnvironment;
  clientId: string;
  secretKey: string;
  apiBaseUrl: string;
  checkoutUrlHost: string;
  notificationUrl: string;
  returnUrl: string;
};

function requiredEnvironmentValue(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required server environment variable ${name}.`);
  }
  return value;
}

function parseAbsoluteUrl(name: string, value: string, allowLocalHttp = false) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be an absolute URL.`);
  }

  const isLocalHttp =
    allowLocalHttp &&
    url.protocol === "http:" &&
    ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (url.protocol !== "https:" && !isLocalHttp) {
    throw new Error(`${name} must use HTTPS.`);
  }
  if (url.username || url.password) {
    throw new Error(`${name} must not contain URL credentials.`);
  }
  return url.toString();
}

export function getDokuEnvironment(): DokuEnvironment {
  const configuredEnvironment = process.env.DOKU_ENV?.trim();
  if (
    configuredEnvironment &&
    configuredEnvironment !== "sandbox" &&
    configuredEnvironment !== "production"
  ) {
    throw new Error("DOKU_ENV must be either sandbox or production.");
  }
  return configuredEnvironment === "production" ? "production" : "sandbox";
}

export function getDokuCheckoutUrlHost(
  environment: DokuEnvironment = getDokuEnvironment(),
) {
  const configuredHost = process.env.DOKU_CHECKOUT_URL_HOST?.trim();
  if (environment === "sandbox") {
    if (configuredHost && configuredHost !== "sandbox.doku.com") {
      throw new Error(
        "DOKU_CHECKOUT_URL_HOST must be sandbox.doku.com in sandbox.",
      );
    }
    return "sandbox.doku.com";
  }

  if (!configuredHost) {
    throw new Error(
      "DOKU_CHECKOUT_URL_HOST must be set to the production Checkout host verified with DOKU.",
    );
  }
  const hostUrl = new URL(`https://${configuredHost}`);
  if (
    hostUrl.hostname !== configuredHost ||
    hostUrl.port ||
    hostUrl.pathname !== "/" ||
    hostUrl.search ||
    hostUrl.hash ||
    (hostUrl.hostname !== "doku.com" &&
      !hostUrl.hostname.endsWith(".doku.com")) ||
    hostUrl.hostname === "sandbox.doku.com"
  ) {
    throw new Error(
      "DOKU_CHECKOUT_URL_HOST must be an exact production host under doku.com.",
    );
  }
  return configuredHost;
}

export function getDokuConfig(): DokuConfig {
  const environment = getDokuEnvironment();
  const checkoutUrlHost = getDokuCheckoutUrlHost(environment);
  const notificationUrl = parseAbsoluteUrl(
    "DOKU_NOTIFICATION_URL",
    requiredEnvironmentValue("DOKU_NOTIFICATION_URL"),
  );
  const returnUrl = parseAbsoluteUrl(
    "DOKU_RETURN_URL",
    requiredEnvironmentValue("DOKU_RETURN_URL"),
    environment === "sandbox",
  );

  return {
    environment,
    clientId: requiredEnvironmentValue("DOKU_CLIENT_ID"),
    secretKey: requiredEnvironmentValue("DOKU_SECRET_KEY"),
    apiBaseUrl:
      environment === "production"
        ? "https://api.doku.com"
        : "https://api-sandbox.doku.com",
    checkoutUrlHost,
    notificationUrl,
    returnUrl,
  };
}
