export class JerseySizeError extends Error {
  constructor(message: string, public readonly signInRequired = false) {
    super(message);
    this.name = "JerseySizeError";
  }
}

function signInError() {
  return new JerseySizeError("Please sign in again to load the jersey sizes.", true);
}

/** Only a provider response can supply selectable sizes; never guess a fallback. */
export async function loadJerseySizes(isAdmin: boolean, signal: AbortSignal): Promise<string[]> {
  const path = isAdmin ? "/api/printify/catalog" : "/api/shop/sizes";

  // A previously cached page/redirect must not be reused as the size response.
  // Retry one unexpected page response with a new URL; leave writes to checkout.
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await fetch(`${path}?refresh=${Date.now()}-${attempt}`, {
      headers: { Accept: "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      redirect: "manual",
      signal,
    });
    if (response.status === 401 || response.type === "opaqueredirect" ||
        (response.status >= 300 && response.status < 400)) {
      throw signInError();
    }

    const text = await response.text();
    const isHtml = /text\/html/i.test(response.headers.get("content-type") ?? "") || /^\s*</.test(text);
    if (isHtml) {
      if (/signin-with-chatgpt|Continue with ChatGPT|Log in to access/i.test(text)) throw signInError();
      if (attempt === 0) continue;
      throw new JerseySizeError("The size service returned a page instead of sizes. Reload ForgeLinc, then try again.");
    }

    let result: unknown;
    try { result = JSON.parse(text); }
    catch {
      throw new JerseySizeError("The size service returned an incomplete response. Please retry sizes.");
    }
    if (!response.ok) {
      const message = result && typeof result === "object" && "error" in result && typeof result.error === "string"
        ? result.error : "Could not load jersey sizes. Please retry.";
      throw new JerseySizeError(message);
    }
    if (!result || typeof result !== "object" || !("variants" in result) || !Array.isArray(result.variants) ||
        result.variants.some(variant => !variant || typeof variant.size !== "string")) {
      throw new JerseySizeError("The provider returned an invalid size list. Please retry sizes.");
    }
    const sizes = [...new Set(result.variants.map(variant => (variant.size as string).trim()).filter(Boolean))];
    if (!sizes.length) throw new JerseySizeError("The provider has no jersey sizes listed right now.");
    return sizes;
  }
  throw new JerseySizeError("Could not load jersey sizes. Please retry.");
}
