# Roadmap do MVP

## Objetivo

Construir um sistema de formalizacao digital de documentos com evidencias de assinatura:

- selfie do assinante
- geolocalizacao via GPS
- endereco IP
- horario do aceite
- PDF final consolidado

## Modulos obrigatorios

1. Usuarios
   - criacao, edicao, exclusao logica e permissao por papel
2. Clientes
   - cadastro, edicao, inativacao e historico
3. Modelos de contrato
   - versionamento, placeholders e ativacao
4. Links de assinatura
   - token publico, expiracao, reenvio e cancelamento
5. Evidencias
   - selfie, GPS, IP, user agent, aceite de termos
6. Documento final
   - PDF, hash e armazenamento
7. Auditoria
   - todo evento relevante precisa ser registrado

## Campos importantes por assinatura

- cliente vinculado
- modelo utilizado e versao
- assinante
- status do fluxo
- token publico do link
- horario de abertura
- horario de assinatura
- selfie capturada
- latitude e longitude
- precisao do GPS
- endereco IP
- user agent
- versao dos termos aceitos
- caminho do PDF final

## Fases sugeridas

### Fase 1

- autenticacao administrativa
- CRUD de usuarios
- CRUD de clientes
- CRUD de modelos
- criacao de links de assinatura

### Fase 2

- pagina publica de assinatura
- coleta de selfie
- coleta de GPS
- captura de IP no backend
- geracao do PDF final

### Fase 3

- dashboard com filtros e historico
- armazenamento em S3
- expiracao automatica de links
- reprocessamento de PDF
- backups e monitoramento

## Cuidados juridicos e operacionais

- deixar o termo de consentimento visivel antes da assinatura
- registrar a versao exata do texto aceito
- proteger selfie e coordenadas como dados sensiveis
- definir politica de retencao e exclusao
- avaliar necessidade futura de OTP por SMS ou e-mail
- avaliar carimbo de tempo externo se o nivel probatorio precisar subir
