/**
 * 权限系统 — 三级角色模型
 *
 *   creator  — 创建者（完全控制）
 *   admin    — 管理者（管理任务与成员）
 *   member   — 参与者（操作自己负责的任务）
 */

export const ROLES = {
  CREATOR: "creator",
  ADMIN: "admin",
  MEMBER: "member",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_HIERARCHY: Record<Role, number> = {
  creator: 3,
  admin: 2,
  member: 1,
};

/** 角色的中文显示名 */
export const ROLE_LABELS: Record<Role, string> = {
  creator: "创建者",
  admin: "管理者",
  member: "参与者",
};

// ============ 权限检查函数 ============

import { prisma } from "@/lib/prisma";

export type MemberInfo = {
  role: Role;
  userId: string;
};

/** 获取用户在清单中的成员信息（含角色） */
export async function getMemberInfo(
  listId: string,
  userId: string,
): Promise<MemberInfo | null> {
  const member = await prisma.listMember.findUnique({
    where: { userId_listId: { userId, listId } },
    select: { role: true, userId: true },
  });
  if (!member) return null;
  return member as MemberInfo;
}

/** 检查是否有指定角色或更高权限 */
export function hasRole(
  member: MemberInfo | null,
  minRole: Role,
): boolean {
  if (!member) return false;
  return ROLE_HIERARCHY[member.role] >= ROLE_HIERARCHY[minRole];
}

/** 能修改清单设置 */
export function canManageList(member: MemberInfo | null): boolean {
  return hasRole(member, "admin");
}

/** 能删除清单 */
export function canDeleteList(member: MemberInfo | null): boolean {
  return hasRole(member, "creator");
}

/** 能添加/移除成员 */
export function canManageMembers(member: MemberInfo | null): boolean {
  return hasRole(member, "admin");
}

/** 能修改成员角色 */
export function canChangeRole(member: MemberInfo | null): boolean {
  return hasRole(member, "creator");
}

/** 能编辑/删除任务 */
export function canModifyTask(
  member: MemberInfo | null,
  taskAssigneeId: string | null,
): boolean {
  if (!member) return false;
  if (hasRole(member, "admin")) return true;
  // 参与者只能操作自己负责的任务
  return member.userId === taskAssigneeId;
}

/** 能删除任务 */
export function canDeleteTask(member: MemberInfo | null): boolean {
  return hasRole(member, "admin");
}

/** 能指派任务 */
export function canAssignTask(member: MemberInfo | null): boolean {
  return hasRole(member, "admin");
}
