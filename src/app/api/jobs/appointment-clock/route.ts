import { NextResponse } from "next/server";
import { appointmentClockAuthorized, runAppointmentClock } from "@/lib/appointments/clock";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "private, no-store" };

async function handle(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret?.trim()) {
    return NextResponse.json({ error: "The appointment clock is not configured." }, { status: 503, headers: noStore });
  }
  if (!appointmentClockAuthorized(request.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "This request was not accepted." }, { status: 401, headers: noStore });
  }
  try {
    const result = await runAppointmentClock(prisma);
    return NextResponse.json(result, { status: 200, headers: noStore });
  } catch {
    console.error("appointment_clock_failed");
    return NextResponse.json({ error: "The appointment clock could not finish." }, { status: 500, headers: noStore });
  }
}

export function GET(request: Request) {
  return handle(request);
}

export function POST(request: Request) {
  return handle(request);
}
