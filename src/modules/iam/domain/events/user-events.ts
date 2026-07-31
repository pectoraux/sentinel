/**
 * Sentinel — IAM Domain Events
 */

import { createDomainEvent, type DomainEvent } from "@/core/shared";

export const UserEvents = {
  Created: (userId: string, email: string): DomainEvent =>
    createDomainEvent({
      aggregateType: "User",
      aggregateId: userId,
      eventType: "user.created",
      payload: { userId, email },
    }),
  LoggedIn: (userId: string, ip?: string): DomainEvent =>
    createDomainEvent({
      aggregateType: "User",
      aggregateId: userId,
      eventType: "user.logged_in",
      payload: { userId, ip },
    }),
  RoleAssigned: (userId: string, roleKey: string, assignedBy?: string): DomainEvent =>
    createDomainEvent({
      aggregateType: "User",
      aggregateId: userId,
      eventType: "user.role_assigned",
      payload: { userId, roleKey, assignedBy },
    }),
  Suspended: (userId: string, reason?: string): DomainEvent =>
    createDomainEvent({
      aggregateType: "User",
      aggregateId: userId,
      eventType: "user.suspended",
      payload: { userId, reason },
    }),
} as const;
