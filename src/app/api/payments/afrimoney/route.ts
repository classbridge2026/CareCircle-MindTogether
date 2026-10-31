import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { afrimoneyNotice } from "@/lib/payments/collect";
import { verifyProviderSignature } from "@/lib/payments/verification";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const raw = await request.text();
  const allowed = verifyProviderSignature({
    body: raw,
    header: request.headers.get("x-afrimoney-signature"),
    secret: process.env.AFRIMONEY_CALLBACK_SECRET ?? null,
  });
  if (!allowed) return NextResponse.json({ ok: false }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return NextResponse.json({ ok: false }, { status: 400 });
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const paymentId = typeof body.externalId === "string" ? body.externalId : typeof body.referenceId === "string" ? body.referenceId : "";
  const status = typeof body.status === "string" ? body.status : "";
  const eventId = typeof body.financialTransactionId === "string" ? body.financialTransactionId : `${paymentId}:${status}`;
  if (!paymentId || !status) return NextResponse.json({ ok: false }, { status: 400 });
  const result = await afrimoneyNotice({ paymentId, status, eventId, amount: body.amount, currency: body.currency }, prisma);
  return NextResponse.json({ ok: result.ok }, { status: result.ok ? 200 : 422 });
}
