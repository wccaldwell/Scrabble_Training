import { CONFIG } from "./config.js";

export async function submitScore(payload) {
  // payload: { name, puzzleKey, gameType, correct, total, timeSeconds, penaltySeconds }
  const { googleFormActionUrl, formFields } = CONFIG;
  const configured = googleFormActionUrl && Object.values(formFields).every(Boolean);

  if (!configured) {
    console.info("[submit] Google Form not configured yet. Payload:", payload);
    return { ok: true, stubbed: true };
  }

  const form = new FormData();
  form.append(formFields.name, payload.name);
  form.append(formFields.puzzleKey, payload.puzzleKey);
  form.append(formFields.gameType, payload.gameType);
  form.append(formFields.correct, String(payload.correct));
  form.append(formFields.total, String(payload.total));
  form.append(formFields.timeSeconds, String(payload.timeSeconds));
  form.append(formFields.penaltySeconds, String(payload.penaltySeconds || 0));

  try {
    // Google Forms doesn't allow reading the response (CORS) but does accept the POST.
    await fetch(googleFormActionUrl, {
      method: "POST",
      mode: "no-cors",
      body: form
    });
    return { ok: true };
  } catch (err) {
    console.error("[submit] failed", err);
    return { ok: false, error: err };
  }
}
