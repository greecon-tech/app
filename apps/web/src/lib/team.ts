import { GREECON_DOMAIN } from "@greecon/shared";

/** Greecon's own accounts (the team's, and the published demo's) are not customers: the clients list keeps them apart. */
export function isOwnAccount(domain: string): boolean {
  return domain === GREECON_DOMAIN || domain === `demo.${GREECON_DOMAIN}`;
}
