import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMemberInfo, canManageMembers } from "@/lib/permissions";

/** Search users by name, username, or email — admin-only for a specific list */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const url = new URL(req.url);
    const query = url.searchParams.get("q");
    const listId = url.searchParams.get("listId");

    if (!query || query.length < 1) {
      return NextResponse.json([]);
    }

    // Must be a list admin to search for users
    if (listId) {
      const member = await getMemberInfo(listId, session.user.id);
      if (!canManageMembers(member)) {
        return NextResponse.json({ error: "无权限" }, { status: 403 });
      }
    }

    const users = await prisma.user.findMany({
      where: {
        AND: [
          {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { username: { contains: query, mode: "insensitive" } },
              { email: { contains: query, mode: "insensitive" } },
            ],
          },
          { id: { not: session.user.id } },
        ],
      },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        avatarUrl: true,
      },
      take: 10,
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error("Search users error:", error);
    return NextResponse.json({ error: "搜索用户失败" }, { status: 500 });
  }
}
