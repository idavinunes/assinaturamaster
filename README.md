## Assinaura Contrato

Base inicial do MVP para formalizacao de documentos com:

- controle de usuarios por nivel de permissao
- controle de clientes
- modelos de contrato versionados
- link publico de assinatura
- coleta de selfie, GPS e IP
- geracao de PDF final com trilha de auditoria

## Stack

- `Next.js 16` com `TypeScript`
- `Prisma` com `PostgreSQL`
- `pdf-lib` para montagem do PDF final
- capturas no navegador para selfie e geolocalizacao
- `ONLYOFFICE Docs` opcional para editar modelos `.docx` como documento Word

## Como subir o projeto

1. Suba o banco local:

```bash
docker compose up -d
```

2. Copie as variaveis:

```bash
cp .env.example .env
```

3. Gere o client do Prisma, rode a migracao e popule dados iniciais:

```bash
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
```

4. Inicie a aplicacao:

```bash
npm run dev
```

Abra `http://localhost:3000`.

## Operacao e migracao

Em ambiente com dados reais, a migracao exige dois itens:

- dump do PostgreSQL
- copia completa do diretorio configurado em `STORAGE_ROOT_DIR` (padrao `./storage`)

O backup so pode ser omitido se o servidor novo for subir vazio, sem reaproveitar historico, evidencias, PDFs, DOCX ou anexos de clientes.

Existe um runbook pronto em `docs/server-migration.md` e um script operacional em `scripts/server-migration.sh`.

Para subir em servidor Ubuntu com PostgreSQL em Docker e Cloudflare Tunnel, veja `docs/server-deploy-ubuntu.md`.
Para primeiro deploy em ambiente novo, sem backup e sem restore, siga esse guia e rode `bash scripts/server-migration.sh prepare` + `npm run db:seed`.
Se quiser automatizar a preparacao do servidor Ubuntu, use `bash scripts/bootstrap-ubuntu-server.sh system` e depois `bash scripts/bootstrap-ubuntu-server.sh app --seed`.

Se o deploy for via Cloudflare Tunnel, voce pode subir a aplicacao local no servidor com:

```bash
npm run start:tunnel
```

Nesse caso, deixe o `APP_URL` com a URL publica final do dominio/tunnel, nao com `localhost`.

## ONLYOFFICE Docs

Para habilitar a edicao visual dos modelos em `.docx`, configure:

```env
ONLYOFFICE_URL="https://documento.agenciasaved.com.br"
ONLYOFFICE_JWT_SECRET="sua-secret-do-document-server"
APP_URL="https://url-publica-da-aplicacao"
ADDITIONAL_ALLOWED_ORIGINS="proxy.exemplo.com,alias.exemplo.com"
```

Observacao importante:

- o `APP_URL` precisa ser publico e acessivel pelo servidor do ONLYOFFICE
- o `APP_URL` tambem define as origens permitidas do Next para server actions
- se existir mais de um host valido, inclua os extras em `ADDITIONAL_ALLOWED_ORIGINS`
- o Document Server precisa conseguir:
  - baixar o arquivo em `/api/onlyoffice/templates/[id]/source`
  - chamar o callback em `/api/onlyoffice/templates/[id]/callback`

Sem isso, o editor abre, mas o salvamento do `.docx` nao volta para a aplicacao.

## Credenciais seed

- email: `admin@assina.local`
- senha: `Admin@123456`

Troque essas credenciais antes de qualquer uso real.

## O que ja foi iniciado

- schema Prisma com usuarios, clientes, modelos, links de assinatura, evidencias, auditoria e PDF final
- pagina inicial com visao do MVP
- demo de coleta de selfie, GPS e IP em `/demo/coleta`
- rota de PDF demo em `/api/demo/pdf`
- composicao local com PostgreSQL via `docker-compose.yml`

## Arquivos importantes

- `prisma/schema.prisma`: modelo de dados principal
- `prisma/seed.mjs`: usuario admin, cliente exemplo e template exemplo
- `docs/mvp-roadmap.md`: requisitos e fases sugeridas
- `docs/server-migration.md`: runbook de migracao e rollback
- `scripts/server-migration.sh`: backup, restore, prepare e smoke test
- `src/lib/pdf/build-signed-contract-pdf.ts`: base da geracao do PDF

## Observacoes de produto

Selfie, GPS e IP aumentam muito a forca probatoria do aceite, mas o fluxo ainda deve incluir:

- texto de consentimento claro
- registro da versao dos termos
- carimbo de data e hora
- retencao e protecao de dados sensiveis em linha com LGPD
