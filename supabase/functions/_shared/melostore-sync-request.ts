export type SyncRequestBodyResult =
  | { ok: true; payload: Record<string, unknown> }
  | { ok: false; status: 400 | 415; message: string };

export async function parseSyncRequestBody(
  req: Request,
): Promise<SyncRequestBodyResult> {
  if (req.body === null) return { ok: true, payload: {} };

  const contentType = req.headers.get("Content-Type")
    ?.split(";")[0].trim().toLowerCase();

  if (contentType !== "application/json") {
    return {
      ok: false,
      status: 415,
      message: "Content-Type harus application/json.",
    };
  }

  try {
    const parsed: unknown = await req.json();

    if (
      parsed === null ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      return {
        ok: false,
        status: 400,
        message: "Body permintaan harus berupa objek JSON.",
      };
    }

    return { ok: true, payload: parsed as Record<string, unknown> };
  } catch {
    return {
      ok: false,
      status: 400,
      message: "Body permintaan bukan JSON yang valid.",
    };
  }
}
