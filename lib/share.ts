/** Copies text to the clipboard; resolves to whether it worked. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older browsers and insecure origins: fall back to a hidden textarea.
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}

/**
 * Hands text to the device's share sheet where there is one worth using (a
 * phone or tablet), and copies it to the clipboard everywhere else. Resolves
 * to what happened; "cancelled" when the player closed the sheet.
 */
export async function shareText(text: string): Promise<"shared" | "copied" | "cancelled" | "failed"> {
  const touch = window.matchMedia("(pointer: coarse)").matches;
  if (touch && typeof navigator.share === "function") {
    try {
      await navigator.share({ text });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
      // The sheet could not open (permissions, an embedded page): copy instead.
    }
  }
  return (await copyText(text)) ? "copied" : "failed";
}
