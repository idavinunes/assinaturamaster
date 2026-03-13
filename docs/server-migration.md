# Migracao para servidor novo

## Diagnostico da documentacao atual

Hoje o projeto documenta bem o setup local, mas ainda nao cobria operacao em producao. Faltavam quatro itens para uma migracao segura:

- inventario do que realmente precisa ser migrado
- criterio claro sobre quando backup e obrigatorio
- sequencia de restore e validacao no servidor novo
- tratamento de dominio/origem para troca de host

Este documento fecha esses pontos.

## Resposta curta sobre backup

Para este projeto, backup e obrigatorio sempre que existir qualquer dado real que precise ser preservado.

Pode subir sem backup apenas em um destes casos:

- ambiente totalmente novo e vazio
- base atual descartavel
- sem necessidade de preservar usuarios, clientes, contratos, evidencias, PDFs e DOCX

Se o objetivo e trocar de servidor mantendo operacao, o backup nao e opcional.

## O que precisa migrar

Os dados persistidos do projeto estao em dois blocos:

1. PostgreSQL
   - usuarios
   - clientes
   - modelos
   - links de assinatura
   - auditoria
   - referencias para arquivos
2. Diretorio configurado em `STORAGE_ROOT_DIR`
   - selfies de assinatura
   - rubricas/desenhos de assinatura
   - PDFs assinados
   - DOCX de modelos
   - documentos anexados aos clientes

Tambem precisam ser levados para o servidor novo:

- `.env` com segredos e URLs corretas
- dominio/proxy/SSL
- integracao com ONLYOFFICE, se estiver em uso

## Variaveis que impactam a migracao

- `DATABASE_URL`: conexao do PostgreSQL no servidor novo
- `APP_URL`: URL publica final da aplicacao
- `AUTH_SECRET`: precisa permanecer estavel se as sessoes/assinaturas existentes precisarem continuar validas
- `ONLYOFFICE_URL`: endpoint do Document Server
- `ONLYOFFICE_JWT_SECRET`: segredo compartilhado com o Document Server
- `STORAGE_ROOT_DIR`: raiz dos arquivos persistidos; padrao `./storage`
- `ADDITIONAL_ALLOWED_ORIGINS`: hosts extras aceitos pelo Next quando houver proxy, alias ou dominio adicional

## Pre-requisitos do servidor novo

- Node.js 22
- npm 10
- PostgreSQL acessivel pela `DATABASE_URL`
- utilitarios `pg_dump`, `pg_restore`, `psql`, `tar`, `curl`
- codigo do projeto clonado
- `.env` ajustado para o novo ambiente

## Sem Nginx: usando Cloudflare Tunnel

Se o acesso externo for feito por Cloudflare Tunnel, o servidor pode expor apenas a aplicacao Node localmente.

Fluxo recomendado:

- suba o app em `127.0.0.1:300`
- aponte o Cloudflare Tunnel para `http://127.0.0.1:300`
- configure o `APP_URL` com o dominio publico final do Tunnel

Comando pronto no projeto:

```bash
npm run start:tunnel
```

Mesmo sem Nginx, o `APP_URL` continua precisando ser publico e coerente com o dominio final.

## Script operacional

O repositório agora inclui `scripts/server-migration.sh` com quatro comandos:

- `backup`: gera dump do PostgreSQL e `storage.tar.gz`
- `restore <backup_dir>`: restaura banco e arquivos no servidor novo
- `prepare`: roda `npm ci`, Prisma e build de producao
- `smoke`: valida a URL configurada em `APP_URL`

## Runbook recomendado

### 1. Congelar a origem

Antes do corte:

- evitar novas alteracoes de dados no servidor antigo
- parar jobs externos que possam continuar gravando
- confirmar que o `storage/` esta sincronizado com o banco

### 2. Gerar backup no servidor antigo

```bash
bash scripts/server-migration.sh backup
```

O backup sera criado em `./backups/<timestamp>/`.

Arquivos esperados:

- `database.dump`
- `storage.tar.gz` (quando existir storage)
- `manifest.txt`

### 3. Copiar os artefatos para o servidor novo

Copie:

- diretorio do backup gerado
- `.env` revisado para o novo host
- codigo da aplicacao

### 4. Ajustar ambiente no servidor novo

Revise pelo menos:

- `DATABASE_URL`
- `APP_URL`
- `AUTH_SECRET`
- `ONLYOFFICE_URL`
- `ONLYOFFICE_JWT_SECRET`
- `STORAGE_ROOT_DIR`
- `ADDITIONAL_ALLOWED_ORIGINS`, se houver mais de um host valido

Observacao importante:

- o projeto agora deriva os `allowedOrigins` do Next a partir do `APP_URL`
- se houver proxy com host alternativo, inclua o host extra em `ADDITIONAL_ALLOWED_ORIGINS`

### 5. Restaurar dados no servidor novo

```bash
bash scripts/server-migration.sh restore /caminho/para/backups/20260313-120000
```

### 6. Preparar a aplicacao

```bash
bash scripts/server-migration.sh prepare
```

### 7. Subir a aplicacao

Exemplo simples com Cloudflare Tunnel:

```bash
npm run start:tunnel
```

Isso sobe a aplicacao em `127.0.0.1:300`.

Se o servidor for permanente, rode isso sob `systemd`, `pm2` ou outro process manager.

### 8. Rodar smoke test

```bash
bash scripts/server-migration.sh smoke
```

### 9. Fazer o corte

- apontar DNS/proxy para o servidor novo
- testar login
- testar painel
- testar download de PDF assinado
- testar documento de cliente
- testar editor ONLYOFFICE, se estiver habilitado

## Rollback

Se o servidor novo falhar:

- mantenha o servidor antigo preservado ate o aceite final
- reverta DNS/proxy para o host antigo
- nao descarte o backup gerado no corte
- se necessario, refaca o restore em outro host limpo

## Quando o restore pode ser pulado

O restore pode ser pulado apenas quando a ideia for iniciar um ambiente limpo.

Nesse caso:

1. configure o `.env`
2. rode `bash scripts/server-migration.sh prepare`
3. opcionalmente execute seed manual:

```bash
npm run db:seed
```

## Riscos operacionais conhecidos

- migrar so o banco sem `storage/` quebra evidencias e arquivos anexados
- trocar `APP_URL` sem revisar proxy/origins pode bloquear server actions
- trocar `AUTH_SECRET` invalida sessoes existentes
- ONLYOFFICE falha se `APP_URL` nao for publico e acessivel pelo Document Server
