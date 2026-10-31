
import {
  rejectInvalidUser,
  requireAal2,
  requireAdmin,
} from "./melostore-auth-gate.ts";

export type AuthDependencies = {
  getUser: (
    accessToken: string,
  ) => Promise<{ user: unknown; error: unknown }>;

  getClaims: (
    accessToken: string,
  ) => Promise<{
    claims: { aal?: unknown } | null | undefined;
    error: unknown;
  }>;

  isAdmin: () => Promise<{
    value: unknown;
    error: unknown;
  }>;
};

export type AuthSuccess = {
  ok: true;
  accessToken: string;
  userId: string;
};

export type AuthFailure = {
  ok: false;
  response: Response;
};

export function withCorsHeaders(
  response: Response,
  corsHeaders: Record<string, string>,
): Response {
  const headers = new Headers(response.headers);

  for (const [name, value] of Object.entries(corsHeaders)) {
    headers.set(name, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

export async function authenticateMelostoreRequest(
  req: Request,
  deps: AuthDependencies,
): Promise<AuthSuccess | AuthFailure> {
  const accessToken = (
    req.headers.get("Authorization") ?? ""
  )
    .replace(/^Bearer\s+/i, "")
    .trim();

  if (!accessToken) {
    return {
      ok: false,
      response: jsonResponse({
        ok: false,
        message: "Sesi login tidak ditemukan. Silakan login kembali.",
      }, 401),
    };
  }

  const { user, error: userError } =
    await deps.getUser(accessToken);

  const userRejection = rejectInvalidUser(
    user,
    userError,
  );

  if (userRejection) {
    return {
      ok: false,
      response: jsonResponse(
        userRejection.body,
        userRejection.status,
      ),
    };
  }

  const { claims, error: claimsError } =
    await deps.getClaims(accessToken);

  const aal2Rejection = requireAal2(
    claims,
    claimsError,
  );

  if (aal2Rejection) {
    return {
      ok: false,
      response: jsonResponse(
        aal2Rejection.body,
        aal2Rejection.status,
      ),
    };
  }

  const { value: admin, error: adminError } =
    await deps.isAdmin();

  const adminRejection = requireAdmin(
    admin,
    adminError,
  );

  if (adminRejection) {
    return {
      ok: false,
      response: jsonResponse(
        adminRejection.body,
        adminRejection.status,
      ),
    };
  }

  
  return {
    ok: true,
    accessToken,
    userId: (user as { id: string }).id,
  };
}

