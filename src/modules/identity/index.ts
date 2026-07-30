/**
 * Sentinel — Identity & Trust module barrel.
 */
export {
  OrganizationService,
  DeviceService,
  IdentityVerificationService,
  TrustProfileService,
  SessionService,
  RoleSwitchService,
  getOrganizationService,
  getDeviceService,
  getIdentityVerificationService,
  getTrustProfileService,
  getSessionService,
  getRoleSwitchService,
} from "./application/services/identity.service";

export {
  Organization,
  Device,
  IdentityVerification,
  TrustProfile,
  computeDeviceFingerprint,
  computeScore,
  tierForScore,
  computeBadges,
  ORG_MEMBER_ROLES,
} from "./domain";

export type {
  OrganizationType,
  OrganizationStatus,
  OrgMemberRole,
  DeviceStatus,
  DevicePlatform,
  VerificationType,
  VerificationStatus,
  TrustTier,
  TrustFactors,
} from "./domain";
