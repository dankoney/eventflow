import { virtualJoinGatewayRedirect } from "@/lib/join/recordVirtualJoinCore";

type RouteContext = { params: { guestId: string } };

export async function GET(_request: Request, context: RouteContext) {
  return virtualJoinGatewayRedirect(context.params.guestId);
}
