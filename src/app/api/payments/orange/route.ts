import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { orangeNotice } from "@/lib/payments/collect";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ ok: false }, { status: 400 });
  const record = body as Record<string, unknown>;
  const orderId = typeof record.order_id === "string" ? record.order_id : "";
  const status = typeof record.status === "string" ? record.status : "";
  const notifToken = typeof record.notif_token === "string" ? record.notif_token : "";
  const txnId = typeof record.txnid === "string" ? record.txnid : "";
  if (!orderId || !status || !notifToken) return NextResponse.json({ ok: false }, { status: 400 });
  const result = await orangeNotice({ orderId, status, notifToken, txnId, amount: record.amount, currency: record.currency }, prisma);
  return NextResponse.json({ ok: result.ok }, { status: result.ok ? 200 : 422 });
}
