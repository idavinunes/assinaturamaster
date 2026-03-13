import { prisma } from "@/lib/prisma";

export type PortfolioSummary = {
  teamId: string;
  teamName: string;
  clientsCount: number;
  executedServicesCount: number;
  signatureRequestsCount: number;
  totalCount: number;
};

export type PortfolioCountByUser = {
  userId: string;
  clientsCount: number;
  executedServicesCount: number;
  signatureRequestsCount: number;
  totalCount: number;
};

export type TeamUnassignedPortfolioSummary = {
  clientsCount: number;
  executedServicesCount: number;
  signatureRequestsCount: number;
  totalCount: number;
};

function withTotalCount<T extends { clientsCount: number; executedServicesCount: number; signatureRequestsCount: number }>(
  input: T,
) {
  return {
    ...input,
    totalCount:
      input.clientsCount + input.executedServicesCount + input.signatureRequestsCount,
  };
}

export async function getPortfolioSummaryByTeamForUser(userId: string): Promise<PortfolioSummary[]> {
  const [clientGroups, executedServiceGroups, signatureGroups] = await Promise.all([
    prisma.client.groupBy({
      by: ["teamId"],
      where: {
        responsibleUserId: userId,
      },
      _count: {
        _all: true,
      },
    }),
    prisma.clientService.groupBy({
      by: ["teamId"],
      where: {
        responsibleUserId: userId,
      },
      _count: {
        _all: true,
      },
    }),
    prisma.signatureRequest.groupBy({
      by: ["teamId"],
      where: {
        responsibleUserId: userId,
      },
      _count: {
        _all: true,
      },
    }),
  ]);

  const summaryByTeam = new Map<
    string,
    {
      teamId: string;
      clientsCount: number;
      executedServicesCount: number;
      signatureRequestsCount: number;
    }
  >();

  for (const group of clientGroups) {
    const current = summaryByTeam.get(group.teamId);
    summaryByTeam.set(
      group.teamId,
      {
        teamId: group.teamId,
        clientsCount: group._count._all,
        executedServicesCount: current?.executedServicesCount ?? 0,
        signatureRequestsCount: current?.signatureRequestsCount ?? 0,
      },
    );
  }

  for (const group of executedServiceGroups) {
    const current = summaryByTeam.get(group.teamId);
    summaryByTeam.set(
      group.teamId,
      {
        teamId: group.teamId,
        clientsCount: current?.clientsCount ?? 0,
        executedServicesCount: group._count._all,
        signatureRequestsCount: current?.signatureRequestsCount ?? 0,
      },
    );
  }

  for (const group of signatureGroups) {
    const current = summaryByTeam.get(group.teamId);
    summaryByTeam.set(
      group.teamId,
      {
        teamId: group.teamId,
        clientsCount: current?.clientsCount ?? 0,
        executedServicesCount: current?.executedServicesCount ?? 0,
        signatureRequestsCount: group._count._all,
      },
    );
  }

  const teamIds = [...summaryByTeam.keys()];

  if (teamIds.length === 0) {
    return [];
  }

  const teams = await prisma.team.findMany({
    where: {
      id: {
        in: teamIds,
      },
    },
    select: {
      id: true,
      name: true,
    },
  });

  const teamNameById = new Map(teams.map((team) => [team.id, team.name]));

  return [...summaryByTeam.values()]
    .map((summary) =>
      withTotalCount({
        ...summary,
        teamName: teamNameById.get(summary.teamId) ?? "Equipe removida",
      }),
    )
    .sort((left, right) => left.teamName.localeCompare(right.teamName, "pt-BR"));
}

export async function getTeamPortfolioCountsByUser(teamId: string): Promise<Map<string, PortfolioCountByUser>> {
  const [clientGroups, executedServiceGroups, signatureGroups] = await Promise.all([
    prisma.client.groupBy({
      by: ["responsibleUserId"],
      where: {
        teamId,
        responsibleUserId: {
          not: null,
        },
      },
      _count: {
        _all: true,
      },
    }),
    prisma.clientService.groupBy({
      by: ["responsibleUserId"],
      where: {
        teamId,
        responsibleUserId: {
          not: null,
        },
      },
      _count: {
        _all: true,
      },
    }),
    prisma.signatureRequest.groupBy({
      by: ["responsibleUserId"],
      where: {
        teamId,
        responsibleUserId: {
          not: null,
        },
      },
      _count: {
        _all: true,
      },
    }),
  ]);

  const countsByUser = new Map<string, PortfolioCountByUser>();

  for (const group of clientGroups) {
    if (!group.responsibleUserId) {
      continue;
    }

    countsByUser.set(
      group.responsibleUserId,
      withTotalCount({
        userId: group.responsibleUserId,
        clientsCount: group._count._all,
        executedServicesCount:
          countsByUser.get(group.responsibleUserId)?.executedServicesCount ?? 0,
        signatureRequestsCount:
          countsByUser.get(group.responsibleUserId)?.signatureRequestsCount ?? 0,
      }),
    );
  }

  for (const group of executedServiceGroups) {
    if (!group.responsibleUserId) {
      continue;
    }

    countsByUser.set(
      group.responsibleUserId,
      withTotalCount({
        userId: group.responsibleUserId,
        clientsCount: countsByUser.get(group.responsibleUserId)?.clientsCount ?? 0,
        executedServicesCount: group._count._all,
        signatureRequestsCount:
          countsByUser.get(group.responsibleUserId)?.signatureRequestsCount ?? 0,
      }),
    );
  }

  for (const group of signatureGroups) {
    if (!group.responsibleUserId) {
      continue;
    }

    countsByUser.set(
      group.responsibleUserId,
      withTotalCount({
        userId: group.responsibleUserId,
        clientsCount: countsByUser.get(group.responsibleUserId)?.clientsCount ?? 0,
        executedServicesCount:
          countsByUser.get(group.responsibleUserId)?.executedServicesCount ?? 0,
        signatureRequestsCount: group._count._all,
      }),
    );
  }

  return countsByUser;
}

export async function getTeamUnassignedPortfolioSummary(
  teamId: string,
): Promise<TeamUnassignedPortfolioSummary> {
  const [clientsCount, executedServicesCount, signatureRequestsCount] = await Promise.all([
    prisma.client.count({
      where: {
        teamId,
        responsibleUserId: null,
      },
    }),
    prisma.clientService.count({
      where: {
        teamId,
        responsibleUserId: null,
      },
    }),
    prisma.signatureRequest.count({
      where: {
        teamId,
        responsibleUserId: null,
      },
    }),
  ]);

  return withTotalCount({
    clientsCount,
    executedServicesCount,
    signatureRequestsCount,
  });
}

export async function transferPortfolioBetweenUsersInTeam(params: {
  teamId: string;
  fromUserId: string;
  toUserId: string;
}) {
  const [clientsResult, executedServicesResult, signatureRequestsResult] =
    await prisma.$transaction([
      prisma.client.updateMany({
        where: {
          teamId: params.teamId,
          responsibleUserId: params.fromUserId,
        },
        data: {
          responsibleUserId: params.toUserId,
        },
      }),
      prisma.clientService.updateMany({
        where: {
          teamId: params.teamId,
          responsibleUserId: params.fromUserId,
        },
        data: {
          responsibleUserId: params.toUserId,
        },
      }),
      prisma.signatureRequest.updateMany({
        where: {
          teamId: params.teamId,
          responsibleUserId: params.fromUserId,
        },
        data: {
          responsibleUserId: params.toUserId,
        },
      }),
    ]);

  return withTotalCount({
    clientsCount: clientsResult.count,
    executedServicesCount: executedServicesResult.count,
    signatureRequestsCount: signatureRequestsResult.count,
  });
}

export async function clearPortfolioResponsibilityInTeam(params: {
  teamId: string;
  userId: string;
}) {
  const [clientsResult, executedServicesResult, signatureRequestsResult] =
    await prisma.$transaction([
      prisma.client.updateMany({
        where: {
          teamId: params.teamId,
          responsibleUserId: params.userId,
        },
        data: {
          responsibleUserId: null,
        },
      }),
      prisma.clientService.updateMany({
        where: {
          teamId: params.teamId,
          responsibleUserId: params.userId,
        },
        data: {
          responsibleUserId: null,
        },
      }),
      prisma.signatureRequest.updateMany({
        where: {
          teamId: params.teamId,
          responsibleUserId: params.userId,
        },
        data: {
          responsibleUserId: null,
        },
      }),
    ]);

  return withTotalCount({
    clientsCount: clientsResult.count,
    executedServicesCount: executedServicesResult.count,
    signatureRequestsCount: signatureRequestsResult.count,
  });
}
