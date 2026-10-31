import { connection } from "next/server";
import { errorResponse, getMembers } from "@/lib/apps-script";

// GET /api/members：名簿（F-01・F-13）
export async function GET() {
  // ビルド時に先に作っておかず、毎回スプシを読みに行く
  await connection();
  try {
    return Response.json({ members: await getMembers() });
  } catch (err) {
    return errorResponse(err);
  }
}
