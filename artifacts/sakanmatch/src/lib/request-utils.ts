import type { RequestItem } from "./api";

export interface StructuredRequestDraft {
  note: string;
  moveIn: string;
  budget: string;
  occupation: string;
  requesterName: string;
}

export interface ParsedStructuredRequest {
  requesterName: string | null;
  occupation: string | null;
  moveIn: string | null;
  budget: string | null;
  note: string | null;
  rawMessage: string | null;
}

const FALLBACK_NOTE = "Interested in this listing.";

export function buildStructuredRequestMessage(draft: StructuredRequestDraft) {
  return [
    `Request from: ${draft.requesterName || "Interested seeker"}`,
    `Occupation: ${draft.occupation || "Not shared"}`,
    `Move-in: ${draft.moveIn || "Flexible"}`,
    `Budget: ${draft.budget || "Not shared"}`,
    `Note: ${draft.note || FALLBACK_NOTE}`,
  ].join("\n");
}

export function parseStructuredRequestMessage(message?: string | null): ParsedStructuredRequest {
  if (!message) {
    return {
      requesterName: null,
      occupation: null,
      moveIn: null,
      budget: null,
      note: null,
      rawMessage: null,
    };
  }

  const lines = message.split("\n").map((line) => line.trim()).filter(Boolean);
  const parsed: ParsedStructuredRequest = {
    requesterName: null,
    occupation: null,
    moveIn: null,
    budget: null,
    note: null,
    rawMessage: message,
  };

  for (const line of lines) {
    if (line.startsWith("Request from:")) parsed.requesterName = line.replace("Request from:", "").trim();
    else if (line.startsWith("Occupation:")) parsed.occupation = line.replace("Occupation:", "").trim();
    else if (line.startsWith("Move-in:")) parsed.moveIn = line.replace("Move-in:", "").trim();
    else if (line.startsWith("Budget:")) parsed.budget = line.replace("Budget:", "").trim();
    else if (line.startsWith("Note:")) parsed.note = line.replace("Note:", "").trim();
  }

  if (!parsed.note) parsed.note = message;
  return parsed;
}

export function getRequestStatusMeta(status: RequestItem["status"]) {
  switch (status) {
    case "accepted":
      return {
        titleKey: "dashboard.accepted",
        descriptionKey: "requests.status.accepted",
      };
    case "declined":
      return {
        titleKey: "dashboard.declined",
        descriptionKey: "requests.status.declined",
      };
    default:
      return {
        titleKey: "requests.status.pendingTitle",
        descriptionKey: "requests.status.pending",
      };
  }
}
