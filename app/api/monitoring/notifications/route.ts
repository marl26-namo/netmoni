import { NextResponse } from "next/server";
import { monitoringStore } from "@/core/monitoring/store";

export async function GET() {
  const [notifications, unread] = await Promise.all([monitoringStore.listNotifications(60), monitoringStore.listUnreadNotifications()]);
  return NextResponse.json({ notifications, unreadCount: unread.length });
}

export async function PATCH(request: Request) {
  const body = await request.json() as { id?: string; all?: boolean };
  if (body.all) {
    const unread = await monitoringStore.listUnreadNotifications();
    await Promise.all(unread.map((notification) => monitoringStore.markNotificationRead(notification.id)));
    return NextResponse.json({ ok: true, marked: unread.length });
  }
  if (!body.id) return NextResponse.json({ error: "id or all is required" }, { status: 400 });
  await monitoringStore.markNotificationRead(body.id);
  return NextResponse.json({ ok: true });
}
