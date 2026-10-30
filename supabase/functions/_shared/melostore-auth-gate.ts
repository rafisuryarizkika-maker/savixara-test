
export type GateRejection = {
  status: 401 | 403;
  body: Record<string, unknown>;
};

export function rejectInvalidUser(
  user: unknown,
  error: unknown,
): GateRejection | null {
  if (error || !user) {
    return {
      status: 401,
      body: {
        ok: false,
        message: "Sesi login tidak valid atau sudah kedaluwarsa.",
      },
    };
  }

  return null;
}

export function requireAal2(
  claims: { aal?: unknown } | null | undefined,
  error: unknown,
): GateRejection | null {
  if (error || claims?.aal !== "aal2") {
    return {
      status: 403,
      body: {
        ok: false,
        message:
          "Autentikasi tambahan AAL2 diperlukan untuk sinkronisasi.",
        requires_mfa: true,
      },
    };
  }

  return null;
}

export function requireAdmin(
  isAdmin: unknown,
  error: unknown,
): GateRejection | null {
  if (error || isAdmin !== true) {
    return {
      status: 403,
      body: {
        ok: false,
        message:
          "Akses ditolak. Hanya admin SAVIXARA yang boleh sinkronisasi.",
      },
    };
  }

  return null;
}
