import { UserRole } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { FileAuthorizationError } from "./exceptions";

export type FileManagerActor = {
  id: string;
  role: UserRole;
  isActive: boolean;
};

export async function getFileManagerActor(): Promise<FileManagerActor | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const actor = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, isActive: true },
  });

  return actor?.isActive &&
    (actor.role === UserRole.ADMIN || actor.role === UserRole.EDITOR)
    ? actor
    : null;
}

export async function requireFileManagerActor(): Promise<FileManagerActor> {
  const actor = await getFileManagerActor();
  if (!actor) throw new FileAuthorizationError();
  return actor;
}

export async function canAccessPrivateFile(
  actor: FileManagerActor,
  fileId: string,
) {
  if (actor.role === UserRole.ADMIN) return true;

  const file = await prisma.fileAsset.findFirst({
    where: {
      id: fileId,
      OR: [
        { createdById: actor.id },
        {
          references: {
            some: {
              OR: [
                {
                  newsRevisionFile: {
                    is: {
                      revision: {
                        news: { is: { authorId: actor.id } },
                      },
                    },
                  },
                },
              ],
            },
          },
        },
      ],
    },
    select: { id: true },
  });

  return Boolean(file);
}
