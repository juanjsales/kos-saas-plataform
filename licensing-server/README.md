# KOS Licensing Server

Servidor Central Online de Gerenciamento de Licenças do KOS On-Premise.

## O que faz

Permite que o **Dono Master (Juan Sales)** emita, gerencie e revogue licenças das lojas parceiras que utilizam o KOS On-Premise, sem precisar acessar fisicamente os computadores dos clientes.

## Como funciona

```
Você (Online) → Emite licença → Envia token ao cliente → Cliente ativa no KOS Local
```

## Setup Local (Desenvolvimento)

```bash
cd licensing-server
npm install
cp .env.example .env
# Edite o .env com sua senha e chave secreta
node server.js
```

Acesse o painel em: **http://localhost:5000**

## Deploy Online Gratuito (Render.com)

1. Crie uma conta em https://render.com
2. Crie um novo **Web Service** apontando para a pasta `licensing-server/`
3. Configure as variáveis de ambiente:
   - `KOS_MASTER_SECRET` = uma chave aleatória longa e secreta
   - `MASTER_PANEL_PASSWORD` = sua senha pessoal
4. Deploy!

O painel ficará disponível em: `https://seu-projeto.onrender.com`

## Endpoints da API

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/` | Painel Web do Dono Master |
| `POST` | `/api/master/issue-license` | Emitir nova licença |
| `POST` | `/api/master/verify-license` | Verificar validade de licença |
| `POST` | `/api/master/revoke-license` | Suspender licença de um cliente |
| `GET` | `/api/master/licenses` | Listar todas as licenças |
| `GET` | `/health` | Status do servidor |

## Variáveis de Ambiente

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `PORT` | Porta do servidor | `5000` |
| `KOS_MASTER_SECRET` | Chave secreta para assinar tokens | (obrigatória) |
| `MASTER_PANEL_PASSWORD` | Senha de acesso ao painel | `kos_admin_2026` |
| `DEFAULT_LICENSE_DAYS` | Dias padrão de validade | `30` |
| `DEFAULT_GRACE_DAYS` | Dias de tolerância offline | `7` |
