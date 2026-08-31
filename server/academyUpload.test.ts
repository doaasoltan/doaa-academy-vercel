import { describe, expect, it } from "vitest";
import { validateDirectUpload } from "./uploadPolicy.js";

describe("direct upload inputs", () => {
  it("keeps PDF and video uploads within the approved direct-upload policy", () => {
    expect(validateDirectUpload({ fileName: "lesson.pdf", mimeType: "application/pdf", bytes: 512 })).toMatchObject({ ok: true });
    expect(validateDirectUpload({ fileName: "lesson.mp4", mimeType: "video/mp4", bytes: 512 })).toMatchObject({ ok: true });
  });
});
