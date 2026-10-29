import { afterEach, describe, expect, it } from "vitest";
import { addGuideFeatures, resetGuideFeatures } from "./guide-model";
import { answerPortalQuestion, chatWithPortal } from "./portal-guide";

const admin = { pathname: "/admin", superAdmin: true };

describe("portal guide model", () => {
  afterEach(() => {
    resetGuideFeatures();
  });

  it("understands a location question that does not use the location keywords", () => {
    const reply = chatWithPortal({ ...admin, question: "Why does the save control stay grey until I choose a marker?" });
    expect(reply.topicId).toBe("locations");
    expect(reply.text).toMatch(/pin/i);
    expect(reply.link?.href).toBe("/admin/locations");
  });

  it("learns an additional feature from example questions", () => {
    addGuideFeatures([
      {
        id: "lab-results",
        title: "Lab results",
        href: "/admin/labs",
        examples: ["where do I publish a blood test", "upload a laboratory result for a completed visit"],
        answer: "Lab results open from the Lab results tab. Publish a result only after the visit is complete.",
      },
    ]);
    const reply = chatWithPortal({ ...admin, question: "where do I publish a blood test" });
    expect(reply.topicId).toBe("lab-results");
    expect(reply.text).toMatch(/Publish a result only after the visit is complete/);
    expect(reply.link?.href).toBe("/admin/labs");
  });

  it("leaves questions outside the portal unanswered by the model", () => {
    const outside = answerPortalQuestion({ ...admin, question: "What is the weather in Freetown?" });
    expect(outside.title).toMatch(/portal/i);
    expect(outside.paragraphs.join(" ")).toMatch(/cannot/i);
  });
});
