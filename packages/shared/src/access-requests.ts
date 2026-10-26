// Someone asking Greecon to set them up. Greecon is sold and installed with a project manager, so
// there is no self-service sign-up that creates an account: a request goes to Greecon, and an
// account is created once there is a site to connect.

export const requestedSiteTypes = ["hotel", "farm", "solar", "water", "other"] as const;
export type RequestedSiteType = (typeof requestedSiteTypes)[number];

export const requestedSiteTypeLabels: Readonly<Record<RequestedSiteType, string>> = {
  hotel: "Hotel or guesthouse",
  farm: "Farm or greenhouse",
  solar: "Solar plant",
  water: "Water or wastewater plant",
  other: "Something else"
};

/** The longest each field of the public "Request access" form may be, in characters: the API refuses longer, and the form can
 * use the same numbers for its own maximum lengths. */
export const ACCESS_REQUEST_LIMITS = { name: 80, company: 120, email: 254, phone: 30, message: 1000 } as const;

export const accessRequestStatuses = ["new", "contacted", "onboarded", "declined"] as const;
export type AccessRequestStatus = (typeof accessRequestStatuses)[number];

export interface AccessRequest {
  id: string;
  name: string;
  company: string;
  email: string;
  phone?: string;
  siteType: RequestedSiteType;
  message?: string;
  status: AccessRequestStatus;
  note?: string;
  createdAtUtc: string;
  updatedAtUtc: string;
}
