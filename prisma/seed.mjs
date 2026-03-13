import "dotenv/config";
import bcrypt from "bcryptjs";
import prismaPkg from "@prisma/client";

const {
  ClientType,
  PrismaClient,
  Role,
  SignatureRequestStatus,
  TeamMemberRole,
  TemplateStatus,
} = prismaPkg;

const prisma = new PrismaClient();
const INITIAL_TEAM_SLUG = "operacao-principal";

function mapRoleToTeamMemberRole(role) {
  if (role === Role.MANAGER) {
    return TeamMemberRole.MANAGER;
  }

  if (role === Role.OPERATOR) {
    return TeamMemberRole.OPERATOR;
  }

  if (role === Role.VIEWER) {
    return TeamMemberRole.VIEWER;
  }

  return TeamMemberRole.ADMIN;
}

async function main() {
  const passwordHash = await bcrypt.hash("Admin@123456", 10);

  await prisma.brandingSettings.upsert({
    where: { singletonKey: "default" },
    update: {
      productName: "Assinaura Contrato",
      productShortName: "Assinaura",
      productTagline: "Assinatura e evidencia",
      logoPath: "/brand-logo.svg",
      browserTitle: "Assinaura Contrato",
      browserDescription:
        "MVP para formalizacao de documentos com selfie, GPS, IP, trilha de auditoria e PDF assinado.",
    },
    create: {
      singletonKey: "default",
      productName: "Assinaura Contrato",
      productShortName: "Assinaura",
      productTagline: "Assinatura e evidencia",
      logoPath: "/brand-logo.svg",
      browserTitle: "Assinaura Contrato",
      browserDescription:
        "MVP para formalizacao de documentos com selfie, GPS, IP, trilha de auditoria e PDF assinado.",
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: "admin@assina.local" },
    update: {
      name: "Administrador Inicial",
      passwordHash,
      role: Role.SUPER_ADMIN,
      isActive: true,
    },
    create: {
      name: "Administrador Inicial",
      email: "admin@assina.local",
      passwordHash,
      role: Role.SUPER_ADMIN,
    },
  });

  const initialTeam = await prisma.team.upsert({
    where: { slug: INITIAL_TEAM_SLUG },
    update: {
      name: "Operacao Principal",
      description: "Equipe base criada para a fase inicial da implantacao.",
      isActive: true,
    },
    create: {
      name: "Operacao Principal",
      slug: INITIAL_TEAM_SLUG,
      description: "Equipe base criada para a fase inicial da implantacao.",
    },
  });

  const users = await prisma.user.findMany({
    select: {
      id: true,
      role: true,
      isActive: true,
    },
  });

  await Promise.all(
    users.map((user) =>
      prisma.userTeamMembership.upsert({
        where: {
          userId_teamId: {
            userId: user.id,
            teamId: initialTeam.id,
          },
        },
        update: {
          role: mapRoleToTeamMemberRole(user.role),
          isActive: user.isActive,
        },
        create: {
          userId: user.id,
          teamId: initialTeam.id,
          role: mapRoleToTeamMemberRole(user.role),
          isActive: user.isActive,
        },
      }),
    ),
  );

  const existingClient = await prisma.client.findFirst({
    where: {
      teamId: initialTeam.id,
      documentNumber: "12345678000199",
    },
    select: {
      id: true,
    },
  });

  const client = existingClient
    ? await prisma.client.update({
        where: { id: existingClient.id },
        data: {
          teamId: initialTeam.id,
          responsibleUserId: admin.id,
          clientType: ClientType.BUSINESS,
          legalName: "Cliente Exemplo LTDA",
          contactName: "Maria Oliveira",
          civilStatus: "Casada",
          rg: "12.345.678-9",
          email: "contato@cliente-exemplo.com.br",
          phone: "11999999999",
          address: "Avenida Paulista, 1000, Bela Vista, Sao Paulo/SP",
          isActive: true,
        },
      })
    : await prisma.client.create({
        data: {
          teamId: initialTeam.id,
          responsibleUserId: admin.id,
          clientType: ClientType.BUSINESS,
          legalName: "Cliente Exemplo LTDA",
          documentNumber: "12345678000199",
          contactName: "Maria Oliveira",
          civilStatus: "Casada",
          rg: "12.345.678-9",
          email: "contato@cliente-exemplo.com.br",
          phone: "11999999999",
          address: "Avenida Paulista, 1000, Bela Vista, Sao Paulo/SP",
          notes: "Cliente seed para demonstracao inicial do fluxo.",
        },
      });

  const existingServiceCatalog = await prisma.serviceCatalog.findFirst({
    where: {
      scope: "GLOBAL",
      name: "Consultoria mensal",
    },
  });

  const serviceCatalog = existingServiceCatalog
    ? await prisma.serviceCatalog.update({
        where: { id: existingServiceCatalog.id },
        data: {
          scope: "GLOBAL",
          ownerTeamId: null,
          description:
            "Acompanhamento consultivo mensal com orientacao operacional e revisao documental.",
          defaultAmount: "2500.00",
          defaultPercentage: "10.00",
          isActive: true,
        },
      })
    : await prisma.serviceCatalog.create({
        data: {
          scope: "GLOBAL",
          ownerTeamId: null,
          name: "Consultoria mensal",
          description:
            "Acompanhamento consultivo mensal com orientacao operacional e revisao documental.",
          defaultAmount: "2500.00",
          defaultPercentage: "10.00",
          isActive: true,
        },
      });

  const existingExecutedService = await prisma.clientService.findFirst({
    where: {
      clientId: client.id,
      serviceCatalog: {
        is: {
          name: "Consultoria mensal",
        },
      },
    },
  });

  const executedService = existingExecutedService
    ? await prisma.clientService.update({
        where: { id: existingExecutedService.id },
        data: {
          teamId: client.teamId,
          responsibleUserId: client.responsibleUserId,
          serviceCatalogId: serviceCatalog.id,
          identificationNumber: "NF-2026-0001",
          description:
            "Acompanhamento consultivo mensal com orientacao operacional e revisao documental.",
          eventAmount: "2500.00",
          servicePercentage: "10.00",
          amount: "250.00",
        },
      })
    : await prisma.clientService.create({
        data: {
          clientId: client.id,
          teamId: client.teamId,
          responsibleUserId: client.responsibleUserId,
          serviceCatalogId: serviceCatalog.id,
          identificationNumber: "NF-2026-0001",
          description:
            "Acompanhamento consultivo mensal com orientacao operacional e revisao documental.",
          eventAmount: "2500.00",
          servicePercentage: "10.00",
          amount: "250.00",
        },
      });

  const existingTemplate = await prisma.contractTemplate.findFirst({
    where: {
      scope: "GLOBAL",
      name: "Contrato de Prestacao de Servicos",
      version: 1,
    },
    select: {
      id: true,
    },
  });

  const template = existingTemplate
    ? await prisma.contractTemplate.update({
        where: {
          id: existingTemplate.id,
        },
        data: {
          status: TemplateStatus.ACTIVE,
        },
      })
    : await prisma.contractTemplate.create({
        data: {
          name: "Contrato de Prestacao de Servicos",
          version: 1,
          status: TemplateStatus.ACTIVE,
          description: "Template base para fechar o MVP e validar o fluxo.",
          body: `CONTRATO DE PRESTACAO DE SERVICOS

Contratante: {{client_display_name}}
Servico: {{service_name}}
Identificacao: {{service_identification_number}}
Descricao do evento: {{service_event_description}}
Valor do evento: {{service_event_amount_formatted}}
Percentual da prestacao: {{service_prestation_percentage_formatted}}
Valor da prestacao: {{service_prestation_amount_formatted}}
Assinante: {{signer_name}}
Email: {{signer_email}}

Ao prosseguir, o assinante declara que leu e concorda com os termos deste contrato. A assinatura sera acompanhada por selfie, GPS, IP e horario do aceite.`,
          variableSchema: JSON.stringify([
            { key: "client_legal_name", label: "Razao social do cliente" },
            { key: "signer_name", label: "Nome do assinante" },
            { key: "signer_email", label: "Email do assinante" },
          ]),
        },
      });

  await prisma.signatureRequest.upsert({
    where: { publicToken: "demo-assinatura-inicial" },
    update: {
      teamId: client.teamId,
      responsibleUserId: client.responsibleUserId,
      title: "Contrato inicial de demonstracao",
      status: SignatureRequestStatus.SENT,
      sentAt: new Date(),
      clientId: client.id,
      serviceId: executedService.id,
      templateId: template.id,
      createdById: admin.id,
    },
    create: {
      publicToken: "demo-assinatura-inicial",
      teamId: client.teamId,
      responsibleUserId: client.responsibleUserId,
      title: "Contrato inicial de demonstracao",
      signerName: "Carlos Souza",
      signerEmail: "carlos.souza@email.com",
      signerDocument: "123.456.789-00",
      signerPhone: "11988887777",
      status: SignatureRequestStatus.SENT,
      sentAt: new Date(),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      clientId: client.id,
      serviceId: executedService.id,
      templateId: template.id,
      createdById: admin.id,
    },
  });

  console.log("Seed concluido com usuario admin, cliente e template de exemplo.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
