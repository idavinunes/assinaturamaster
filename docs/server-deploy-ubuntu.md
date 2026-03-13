# Deploy em servidor Ubuntu com Cloudflare Tunnel

## Escopo

Este guia assume:

- servidor Ubuntu 24.04 LTS ou 22.04 LTS
- Node.js 22 e npm 10 ja instalados no host
- PostgreSQL rodando em Docker Compose
- aplicacao Next.js rodando no host em `127.0.0.1:300`
- publicacao externa feita por Cloudflare Tunnel

Se o seu servidor nao for Ubuntu/Debian, ajuste apenas a etapa de instalacao do Docker.

## Arquitetura recomendada

- `docker compose up -d` para o PostgreSQL
- `npm run start:tunnel` para a aplicacao
- Cloudflare Tunnel apontando para `http://127.0.0.1:300`

Isso elimina a necessidade de Nginx neste projeto.

## Fluxo recomendado para o seu caso

Como o servidor sera novo e voce nao vai restaurar backup, o fluxo principal fica assim:

1. instalar Docker/Compose
2. clonar o repositório
3. configurar `.env`
4. subir o PostgreSQL com `docker compose up -d`
5. rodar `bash scripts/server-migration.sh prepare`
6. rodar `npm run db:seed`
7. subir a aplicacao com `npm run start:tunnel`
8. apontar o Cloudflare Tunnel para `http://127.0.0.1:300`

## 1. Preparar o servidor

Atualize os pacotes base:

```bash
sudo apt update
sudo apt install -y ca-certificates curl git
node -v
npm -v
```

Se `node` e `npm` ainda nao estiverem instalados, resolva isso antes de seguir com o deploy da aplicacao.

## 2. Instalar Docker Engine e Docker Compose

Passos baseados na documentacao oficial do Docker para Ubuntu:

1. Remova pacotes antigos, se existirem:

```bash
for pkg in docker.io docker-doc docker-compose podman-docker containerd runc; do
  sudo apt-get remove -y "$pkg"
done
```

2. Adicione a chave GPG e o repositório oficial do Docker:

```bash
sudo apt update
sudo apt install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
sudo tee /etc/apt/sources.list.d/docker.sources >/dev/null <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Signed-By: /etc/apt/keyrings/docker.asc
EOF
sudo apt update
```

3. Instale Docker Engine e o plugin do Compose:

```bash
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

4. Verifique a instalacao:

```bash
sudo systemctl status docker --no-pager
sudo docker run hello-world
docker compose version
```

5. Opcional, para rodar Docker sem `sudo`:

```bash
sudo usermod -aG docker "$USER"
newgrp docker
```

## 3. Clonar o repositório

```bash
git clone https://github.com/idavinunes/assinaturamaster.git
cd assinaturamaster
```

## 4. Configurar o ambiente

Crie o `.env` a partir do exemplo:

```bash
cp .env.example .env
```

Revise pelo menos estas variaveis:

- `DATABASE_URL`
- `APP_URL`
- `AUTH_SECRET`
- `ONLYOFFICE_URL`
- `ONLYOFFICE_JWT_SECRET`
- `STORAGE_ROOT_DIR`
- `ADDITIONAL_ALLOWED_ORIGINS`

Exemplo de valores para servidor novo:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/assinaura_contrato?schema=public"
APP_URL="https://SEU-DOMINIO-PUBLICO"
AUTH_SECRET="troque-por-um-segredo-forte"
ONLYOFFICE_URL="https://documento.agenciasaved.com.br"
ONLYOFFICE_JWT_SECRET="troque-pelo-valor-correto"
STORAGE_ROOT_DIR="./storage"
ADDITIONAL_ALLOWED_ORIGINS=""
```

Observacao:

- `APP_URL` precisa ser o dominio publico final, nao `localhost`
- o projeto usa `APP_URL` para derivar as origens permitidas do Next
- se o Tunnel responder por mais de um host, liste os extras em `ADDITIONAL_ALLOWED_ORIGINS`

## 5. Subir o PostgreSQL com Docker

Este projeto ja inclui `docker-compose.yml`.

Suba o banco:

```bash
docker compose up -d
docker compose ps
```

Teste se o container ficou saudavel:

```bash
docker compose logs postgres --tail=50
```

## 6. Inicializar os dados

### Opcao principal: ambiente novo, sem backup

Se o servidor vai nascer limpo, sem restore:

```bash
bash scripts/server-migration.sh prepare
npm run db:seed
```

### Opcao alternativa: migracao com dados existentes

Se no futuro voce for restaurar um backup:

```bash
bash scripts/server-migration.sh restore /caminho/para/o/backup
bash scripts/server-migration.sh prepare
```

## 7. Subir a aplicacao localmente para o Tunnel

```bash
npm run start:tunnel
```

Esse comando publica o app apenas em:

```text
127.0.0.1:300
```

## 8. Apontar o Cloudflare Tunnel

No Cloudflare Tunnel, aponte o servico HTTP para:

```text
http://127.0.0.1:300
```

Nao aponte para `localhost:3000`, porque o projeto foi preparado para subir em `127.0.0.1:300` no servidor.

## 9. Validacao final

Depois que o Tunnel estiver ativo:

```bash
bash scripts/server-migration.sh smoke
```

Valide tambem manualmente:

- login
- painel administrativo
- download de PDF assinado
- upload/download de documento de cliente
- ONLYOFFICE, se estiver habilitado

## 10. Atualizar o projeto depois

Quando houver novas alteracoes no GitHub:

```bash
git pull origin main
bash scripts/server-migration.sh prepare
```

Se houver mudanca de schema, o `prepare` ja aplica `prisma migrate deploy`.

## 11. Comandos uteis

Ver o banco:

```bash
docker compose ps
docker compose logs -f postgres
```

Parar o banco:

```bash
docker compose down
```

Reiniciar o banco:

```bash
docker compose restart postgres
```

Gerar backup no proprio servidor:

```bash
bash scripts/server-migration.sh backup
```

## Referencias oficiais

- Docker Engine no Ubuntu: https://docs.docker.com/engine/install/ubuntu/
- Docker Compose plugin no Linux: https://docs.docker.com/compose/install/linux/
