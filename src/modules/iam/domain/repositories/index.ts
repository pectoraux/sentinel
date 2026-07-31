/**
 * Sentinel — IAM Domain: Repository ports
 */

import type { Repository } from "@/core/shared";
import type { User } from "./user";
import type { Role } from "./role";

export interface UserRepository extends Repository<User> {
  findByEmail(email: string): Promise<User | null>;
  list(params?: { status?: string; limit?: number; offset?: number }): Promise<User[]>;
}

export interface RoleRepository extends Repository<Role> {
  findByKey(key: string): Promise<Role | null>;
  list(): Promise<Role[]>;
  findPermissionsForUser(userId: string): Promise<string[]>;
  findRolesForUser(userId: string): Promise<string[]>;
}
