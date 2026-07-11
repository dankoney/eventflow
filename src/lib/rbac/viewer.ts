import type { Session } from "next-auth";

import type { ViewerContext } from "./types";

export function viewerFromSession(session: Session): ViewerContext {
  return {
    userId: session.user.id,
    role: session.user.role,
    orgId: session.user.orgId,
    sessionId: session.sessionId ?? null
  };
}
