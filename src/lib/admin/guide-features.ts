export type GuideFeature = {
  id: string;
  title: string;
  href: string;
  examples: string[];
  answer: string;
};

/**
 * Add a portal feature here when a new admin area is built.
 * The assistant trains on `examples` and answers with `answer`.
 * No matcher code has to change.
 */
export const GUIDE_FEATURES: GuideFeature[] = [];

/** Extra ways an admin might ask about a feature that already exists. */
export const GUIDE_EXAMPLES: Array<{ id: string; text: string }> = [
  { id: "locations", text: "save stays grey until a marker is chosen on the chart" },
  { id: "locations", text: "the save control stays off until I pick a marker" },
  { id: "locations", text: "I cannot store the place until the marker is chosen" },
  { id: "reconciliation", text: "the two recorded sums do not agree with each other" },
  { id: "reconciliation", text: "stored money does not match the visit charge" },
  { id: "operations", text: "the reservation timer ran out before anyone paid" },
  { id: "operations", text: "a hold expired and the visit was never confirmed" },
  { id: "screening", text: "turn on the mood questions people answer before they are seen" },
  { id: "doctors", text: "bring a new clinician onto the roster and send them a link" },
  { id: "verification", text: "someone submitted their papers and is waiting for a yes or no" },
  { id: "pricing", text: "change what a visit costs without rewriting bookings already made" },
  { id: "invitations", text: "the join link never arrived so send that message again" },
  { id: "audit", text: "who changed this record and at what time" },
  { id: "reports", text: "show me the counts between two dates" },
  { id: "roles", text: "let another staff member manage the portal" },
  { id: "payments", text: "show the stored charge but do not mark it captured" },
];
