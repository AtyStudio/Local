import type { ListingResponse } from "@workspace/api-client-react";
import type { FullProfileResponse, PublicProfileResponse, PreferencesResponse, UserProfileResponse } from "./api";

export type ListingFitReasonKey =
  | "preferred_city"
  | "within_budget"
  | "move_in_timing"
  | "preferred_tenant"
  | "utilities_included";

export function computeProfileCompletion(profile: {
  profile: UserProfileResponse | null;
  preferences: PreferencesResponse | null;
}): number {
  const profileFields = [
    "fullName",
    "age",
    "gender",
    "occupation",
    "bio",
    "cleanlinessLevel",
    "sleepSchedule",
    "noiseTolerance",
    "guestPreference",
    "petPreference",
    "moveInDate",
  ] as const;
  const prefFields = ["city", "budgetMin", "budgetMax", "lifestyle", "smoking"] as const;

  let filled = 0;
  const total = profileFields.length + prefFields.length;

  for (const field of profileFields) {
    const value = profile.profile?.[field];
    if (value !== null && value !== undefined && value !== "") filled++;
  }

  for (const field of prefFields) {
    const value = profile.preferences?.[field];
    if (value !== null && value !== undefined && value !== "") filled++;
  }

  return Math.round((filled / total) * 100);
}

export function getRoomTypeLabelKey(roomType?: string | null): string {
  switch (roomType) {
    case "private_room":
      return "listings.roomTypes.private_room";
    case "shared_room":
      return "listings.roomTypes.shared_room";
    case "studio":
      return "listings.roomTypes.studio";
    case "entire_place":
      return "listings.roomTypes.entire_place";
    default:
      return "listings.roomTypes.room";
  }
}

export function getTenantGenderLabelKey(value?: string | null): string {
  switch (value) {
    case "male":
      return "listings.tenantPreference.male";
    case "female":
      return "listings.tenantPreference.female";
    default:
      return "listings.tenantPreference.no_preference";
  }
}

export function getListingTrustSignals(listing: ListingResponse) {
  const signals = [
    {
      label: listing.isIdentityVerified ? "Identity checked" : "Identity check pending",
      tone: listing.isIdentityVerified ? "positive" : "muted",
    },
    {
      label: listing.isLocationVerified ? "Location checked" : "Location not yet checked",
      tone: listing.isLocationVerified ? "positive" : "muted",
    },
    {
      label: listing.furnished ? "Furnished details included" : "Furnishing stated clearly",
      tone: "neutral",
    },
  ] as const;

  return signals;
}

export function getListingFitReasonKeys(
  listing: ListingResponse,
  profile: FullProfileResponse | null,
) : ListingFitReasonKey[] {
  if (!profile) return [];

  const reasons: ListingFitReasonKey[] = [];
  const prefs = profile.preferences;
  const userProfile = profile.profile;

  if (prefs?.city && prefs.city.toLowerCase() === listing.city.toLowerCase()) {
    reasons.push("preferred_city");
  }

  const budgetMin = prefs?.budgetMin ? parseFloat(prefs.budgetMin) : null;
  const budgetMax = prefs?.budgetMax ? parseFloat(prefs.budgetMax) : null;
  if (
    budgetMin !== null &&
    budgetMax !== null &&
    listing.price >= budgetMin &&
    listing.price <= budgetMax
  ) {
    reasons.push("within_budget");
  }

  if (userProfile?.moveInDate && listing.availableFrom) {
    const seekerMoveIn = new Date(userProfile.moveInDate).getTime();
    const availableFrom = new Date(listing.availableFrom).getTime();
    const diffDays = Math.abs(seekerMoveIn - availableFrom) / (1000 * 60 * 60 * 24);
    if (diffDays <= 21) {
      reasons.push("move_in_timing");
    }
  }

  if (
    userProfile?.gender &&
    listing.preferredTenantGender &&
    listing.preferredTenantGender !== "no_preference" &&
    userProfile.gender === listing.preferredTenantGender
  ) {
    reasons.push("preferred_tenant");
  }

  if (listing.utilitiesIncluded) {
    reasons.push("utilities_included");
  }

  return reasons.slice(0, 4);
}

export function getPublicProfileCompletion(profile: PublicProfileResponse): number {
  return computeProfileCompletion({
    profile: profile.profile,
    preferences: profile.preferences,
  });
}
