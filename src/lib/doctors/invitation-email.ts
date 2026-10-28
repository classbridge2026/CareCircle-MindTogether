export function formatWhen(value: Date): string {
  return (
    new Intl.DateTimeFormat("en-GB", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: "UTC",
    }).format(value) + " UTC"
  );
}

export function doctorInvitationText(input: {
  doctorName: string;
  systemName: string;
  inviteUrl: string;
  expiresAt: Date;
}): { subject: string; text: string } {
  return {
    subject: `Your ${input.systemName} doctor account`,
    text: [
      `Hello ${input.doctorName},`,
      "",
      `Your ${input.systemName} doctor account is ready. Open the address below to set your password and finish your professional profile.`,
      "",
      input.inviteUrl,
      "",
      `This address stops working at ${formatWhen(input.expiresAt)}.`,
      "",
      "Patients can be assigned only after an administrator verifies the profile.",
      "",
      "If you were not expecting this account, ignore this message.",
      "",
      input.systemName,
    ].join("\n"),
  };
}
