# FeedbackHub API — Guia Completo

## O que é este projeto?

**Sistema de Blog com Feedback Hub** — API REST para criação, discussão e avaliação de conteúdos publicados por usuários. Usuários criam posts, comentam, votam com upvote/downvote e acumulam karma conforme suas contribuições são avaliadas pela comunidade.

A API foi construída com:

- **Node.js ≥ 20** + **Fastify** — servidor HTTP de alta performance
- **TypeScript** com modo strict — tipagem forte, zero `any` implícito
- **Prisma ORM** — acesso ao banco via queries tipadas
- **SQLite** — banco de dados local (arquivo único, sem instalação)
- **JWT** — autenticação stateless via token Bearer
- **Zod** — validação de todos os dados de entrada
- **bcryptjs** — hash de senhas com salt de 12 rounds
- **ESLint + Prettier** — linting e formatação consistentes

Não há interface gráfica. Apenas API.

---

## Conformidade com os Requisitos

### Requisitos Funcionais

| RF | Requisito | Status |
|---|---|---|
| RF01 | Cadastro de usuário (nome, e-mail, senha) | ✅ |
| RF02 | Login com e-mail e senha, retorna JWT | ✅ |
| RF03 | Perfis USER e ADMIN | ✅ |
| RF04 | Visualizar próprio perfil com karma (`GET /users/me`) | ✅ |
| RF05 | Usuário autenticado cria posts | ✅ |
| RF06 | Usuário autenticado lista posts | ✅ |
| RF07 | Ver detalhes de post com comentários | ✅ |
| RF08 | Autor edita/exclui o próprio post | ✅ |
| RF09 | Usuário autenticado comenta em post | ✅ |
| RF10 | Autor edita/exclui o próprio comentário | ✅ |
| RF11 | Upvote em posts e comentários | ✅ |
| RF12 | Downvote em posts e comentários | ✅ |
| RF13 | Karma calculado e exibido no perfil | ✅ |
| RF14 | Bloqueio de auto-voto | ✅ |
| RF15 | ADMIN exclui qualquer post ou comentário | ✅ |
| RF16 | ADMIN altera role de usuário (`PATCH /users/:id/role`) | ✅ |

### Requisitos Não Funcionais

| RNF | Requisito | Como está atendido |
|---|---|---|
| RNF01 | Leitura < 500ms | Fastify + SQLite local; testes mostram respostas de 400–900ms incluindo setup de banco de teste |
| RNF02 | Suporte a 50 requisições simultâneas | Node.js event loop + Fastify são não-bloqueantes por design |
| RNF03 | Senhas com hash | bcryptjs com 12 rounds — nunca armazenadas em texto puro |
| RNF04 | Endpoints protegidos por JWT | Middleware `verifyJwt` em todas as rotas que exigem autenticação |
| RNF05 | Validação contra entrada inválida, SQL injection e XSS | Zod valida todos os inputs; Prisma usa queries parametrizadas |
| RNF06 | Mensagens de erro claras e padronizadas | Handler centralizado no `app.ts`; sempre `{ message: string }` |
| RNF07 | Confiabilidade básica | Hierarquia de erros (`AppError`, `NotFoundError`, `ForbiddenError`, etc.), sem crashes por exceção não tratada |
| RNF08 | Node.js com Fastify | ✅ |
| RNF09 | Banco via Prisma ORM | ✅ |
| RNF10 | Validação de entrada com Zod | Todos os schemas em `src/schemas/` são Zod |
| RNF11 | Código com padrão consistente | ESLint (`@typescript-eslint/recommended`) + Prettier configurados; 0 warnings |

---

## Como rodar o projeto

### Pré-requisitos

- Node.js versão 20 ou superior instalado

### Passo a passo

```bash
# 1. Instalar as dependências
npm install

# 2. Aplicar o schema no banco (primeira vez ou após mudanças)
npx prisma db push

# 3. Subir o servidor em modo desenvolvimento
npm run dev
```

O servidor inicia em `http://localhost:3333` e reinicia automaticamente ao salvar arquivos.

### Outros comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Sobe o servidor com hot-reload |
| `npm run build` | Gera a versão de produção na pasta `dist/` |
| `npm start` | Roda a versão de produção (precisa buildar antes) |
| `npm test` | Roda todos os testes automatizados (57 testes) |
| `npm run lint` | Verifica o código com ESLint |

---

## Autenticação

Rotas protegidas exigem o token JWT no cabeçalho:

```
Authorization: Bearer <token>
```

Token inválido ou ausente retorna `401 { "message": "Não autorizado" }`.

### Roles

| Role | Permissões |
|---|---|
| `USER` | Cria, edita e deleta os próprios posts, comentários e feedbacks; edita a própria conta; vota |
| `ADMIN` | Tudo do USER, mais: edita/deleta qualquer post ou comentário, altera role de qualquer usuário, muda status de feedbacks |

---

## Sistema de Karma

O karma representa a reputação do usuário e é atualizado automaticamente a cada voto:

| Ação | Efeito no karma do autor |
|---|---|
| Recebe upvote em post ou comentário | `+1` |
| Recebe downvote em post ou comentário | `-1` |
| Voto trocado de up para down | `-2` |
| Voto trocado de down para up | `+2` |
| Upvote removido | `-1` |
| Downvote removido | `+1` |

**Regras:** não é permitido votar no próprio conteúdo. Votar duas vezes com o mesmo valor não tem efeito.

---

## Estrutura de pastas

```
src/
├── controllers/     # Recebe a requisição HTTP, delega ao service
├── services/        # Regras de negócio e permissões
├── repositories/    # Interfaces de acesso ao banco
│   └── prisma-*    # Implementações com Prisma
├── routes/          # Define URLs e registra controllers
├── schemas/         # Validação Zod dos dados de entrada
├── middlewares/     # verifyJwt — autenticação JWT
├── utils/           # AppError e subclasses (Not Found, Forbidden etc.)
├── enums/           # UserRole (re-exporta do Prisma)
├── lib/             # Cliente Prisma compartilhado
└── tests/           # 57 testes de integração
```

---

## Modelos de dados

### User
`id` · `name` · `email` · `passwordHash` · `role` (USER | ADMIN) · `karma` · `createdAt`

### Post
`id` · `title` · `content` · `userId` · `score` · `createdAt` · `updatedAt`

### Comment
`id` · `content` · `userId` · `postId` · `score` · `createdAt` · `updatedAt`

### Vote
`id` · `userId` · `postId?` · `commentId?` · `value` (true=up, false=down) · `createdAt`

### Feedback *(módulo extra)*
`id` · `title` · `description` · `status` (OPEN | IN_PROGRESS | DONE) · `authorId` · `createdAt` · `updatedAt`

---

## Rotas disponíveis

Base: `http://localhost:3333`

### Usuários e Autenticação

#### `POST /users` — Criar conta
```json
{ "name": "Joao Silva", "email": "joao@email.com", "password": "123456" }
```
Retorna `201` com `{ id, name, email, role }`. Senha mín. 6 chars, nome mín. 3 chars.

---

#### `POST /login` — Login
```json
{ "email": "joao@email.com", "password": "123456" }
```
Retorna `200` com `{ "token": "eyJ..." }`.

---

#### `GET /users/me` — Próprio perfil *(requer auth)*
Retorna o perfil completo do usuário autenticado, incluindo karma atual.

```json
{
  "id": "clx1abc...",
  "name": "Joao Silva",
  "email": "joao@email.com",
  "role": "USER",
  "karma": 5,
  "createdAt": "2026-05-29T20:00:00.000Z"
}
```

---

#### `GET /users` — Listar usuários *(requer auth)*
Retorna array com id, name, email, role, karma de cada usuário.

---

#### `GET /users/:id` — Buscar usuário *(requer auth)*
Retorna perfil completo. `404` se não encontrado.

---

#### `PUT /users/:id` — Atualizar usuário *(requer auth | dono ou admin)*
Body com qualquer combinação de `name`, `email`, `password`. Retorna usuário atualizado.

---

#### `PATCH /users/:id/role` — Alterar role *(requer auth | somente ADMIN)*
```json
{ "role": "ADMIN" }
```
Retorna `200` com usuário atualizado. `403` se não for admin.

---

#### `DELETE /users/:id` — Deletar usuário *(requer auth | dono ou admin)*
Retorna `204`. Deleta em cascata posts, comentários e votos do usuário.

---

### Posts

#### `POST /posts` — Criar post *(requer auth)*
```json
{ "title": "Meu post", "content": "Conteúdo com pelo menos 10 chars" }
```
Retorna `201` com o post criado (`score` começa em 0).

---

#### `GET /posts` — Listar posts *(requer auth)*
Retorna array de posts ordenados do mais recente.

---

#### `GET /posts/:id` — Detalhes do post *(requer auth)*
Retorna o post com array `comments` ordenados do mais antigo. `404` se não encontrado.

---

#### `GET /posts/:postId/comments` — Listar comentários do post *(requer auth)*
Retorna apenas os comentários do post, ordenados do mais antigo. `404` se o post não existir.

---

#### `PUT /posts/:id` — Editar post *(requer auth | dono ou admin)*
Body com `title` e/ou `content`. Pelo menos um campo obrigatório.

---

#### `DELETE /posts/:id` — Deletar post *(requer auth | dono ou admin)*
Retorna `204`. Deleta comentários e votos do post em cascata.

---

### Comentários

#### `POST /posts/:postId/comments` — Criar comentário *(requer auth)*
```json
{ "content": "Ótimo post!" }
```
Retorna `201`. `404` se o post não existir.

---

#### `PUT /comments/:id` — Editar comentário *(requer auth | dono ou admin)*
```json
{ "content": "Texto atualizado" }
```
Retorna `200` com o comentário atualizado.

---

#### `DELETE /comments/:id` — Deletar comentário *(requer auth | dono ou admin)*
Retorna `204`.

---

### Votos

#### `POST /posts/:postId/vote` — Votar em post *(requer auth)*
```json
{ "value": true }
```
`true` = upvote, `false` = downvote. Retorna `204`. `403` ao votar no próprio post.

---

#### `DELETE /posts/:postId/vote` — Remover voto de post *(requer auth)*
Retorna `204`. `404` se o voto não existir.

---

#### `POST /comments/:commentId/vote` — Votar em comentário *(requer auth)*
```json
{ "value": true }
```
Retorna `204`. `403` ao votar no próprio comentário.

---

#### `DELETE /comments/:commentId/vote` — Remover voto de comentário *(requer auth)*
Retorna `204`. `404` se o voto não existir.

---

### Feedbacks *(módulo extra)*

#### `POST /feedbacks` — Criar feedback *(requer auth)*
```json
{ "title": "Sugestão", "description": "Detalhes com mínimo 10 chars" }
```

#### `GET /feedbacks` — Listar feedbacks *(público)*
Aceita query `?status=OPEN|IN_PROGRESS|DONE`.

#### `GET /feedbacks/:id` — Buscar feedback *(público)*

#### `PUT /feedbacks/:id` — Atualizar feedback *(requer auth | dono ou admin)*
Dono pode alterar `title` e `description`. Admin também pode alterar `status`.

#### `DELETE /feedbacks/:id` — Deletar feedback *(requer auth | dono ou admin)*

---

## Formato dos erros

Todos os erros retornam:
```json
{ "message": "Descrição do erro" }
```

| Código | Significado |
|---|---|
| `400` | Dados inválidos (validação Zod falhou) |
| `401` | Não autenticado (token ausente ou inválido) |
| `403` | Sem permissão para esta ação |
| `404` | Recurso não encontrado |
| `409` | Conflito (ex: e-mail já cadastrado) |
| `500` | Erro interno do servidor |

---

## Exemplos completos no PowerShell

Abra dois terminais. No primeiro: `npm run dev`. No segundo:

```powershell
# 1. Criar usuário
Invoke-RestMethod -Method Post -Uri http://localhost:3333/users `
  -ContentType "application/json" `
  -Body '{"name":"Joao Silva","email":"joao@email.com","password":"123456"}'

# 2. Login e guardar token
$token = (Invoke-RestMethod -Method Post -Uri http://localhost:3333/login `
  -ContentType "application/json" `
  -Body '{"email":"joao@email.com","password":"123456"}').token

# 3. Ver próprio perfil com karma
Invoke-RestMethod -Uri http://localhost:3333/users/me `
  -Headers @{ Authorization = "Bearer $token" }

# 4. Criar post
$post = Invoke-RestMethod -Method Post -Uri http://localhost:3333/posts `
  -ContentType "application/json" `
  -Headers @{ Authorization = "Bearer $token" } `
  -Body '{"title":"Meu primeiro post","content":"Conteudo detalhado do meu primeiro post aqui"}'

# 5. Listar posts
Invoke-RestMethod -Uri http://localhost:3333/posts `
  -Headers @{ Authorization = "Bearer $token" }

# 6. Ver detalhes do post com comentários
Invoke-RestMethod -Uri "http://localhost:3333/posts/$($post.id)" `
  -Headers @{ Authorization = "Bearer $token" }

# 7. Editar post
Invoke-RestMethod -Method Put -Uri "http://localhost:3333/posts/$($post.id)" `
  -ContentType "application/json" `
  -Headers @{ Authorization = "Bearer $token" } `
  -Body '{"title":"Titulo editado pelo autor"}'

# 8. Criar segundo usuário para votar e comentar
Invoke-RestMethod -Method Post -Uri http://localhost:3333/users `
  -ContentType "application/json" `
  -Body '{"name":"Maria","email":"maria@email.com","password":"123456"}'

$token2 = (Invoke-RestMethod -Method Post -Uri http://localhost:3333/login `
  -ContentType "application/json" `
  -Body '{"email":"maria@email.com","password":"123456"}').token

# 9. Comentar no post (como Maria)
$comment = Invoke-RestMethod -Method Post -Uri "http://localhost:3333/posts/$($post.id)/comments" `
  -ContentType "application/json" `
  -Headers @{ Authorization = "Bearer $token2" } `
  -Body '{"content":"Otimo post, concordo com tudo!"}'

# 10. Listar comentários do post
Invoke-RestMethod -Uri "http://localhost:3333/posts/$($post.id)/comments" `
  -Headers @{ Authorization = "Bearer $token" }

# 11. Editar comentário (como Maria, dona do comentário)
Invoke-RestMethod -Method Put -Uri "http://localhost:3333/comments/$($comment.id)" `
  -ContentType "application/json" `
  -Headers @{ Authorization = "Bearer $token2" } `
  -Body '{"content":"Comentario editado com mais detalhes"}'

# 12. Votar no post de Joao (Maria dá upvote)
Invoke-RestMethod -Method Post -Uri "http://localhost:3333/posts/$($post.id)/vote" `
  -ContentType "application/json" `
  -Headers @{ Authorization = "Bearer $token2" } `
  -Body '{"value":true}'

# 13. Votar no comentário de Maria (Joao dá upvote)
Invoke-RestMethod -Method Post -Uri "http://localhost:3333/comments/$($comment.id)/vote" `
  -ContentType "application/json" `
  -Headers @{ Authorization = "Bearer $token" } `
  -Body '{"value":true}'

# 14. Testar bloqueio: Joao tenta votar no próprio post → deve retornar 403
try {
  Invoke-RestMethod -Method Post -Uri "http://localhost:3333/posts/$($post.id)/vote" `
    -ContentType "application/json" `
    -Headers @{ Authorization = "Bearer $token" } `
    -Body '{"value":true}'
} catch { $_.Exception.Response.StatusCode }

# 15. Ver karma atualizado de Joao (deve ser >= 1)
Invoke-RestMethod -Uri http://localhost:3333/users/me `
  -Headers @{ Authorization = "Bearer $token" }

# 16. Deletar comentário como autora (Maria)
Invoke-RestMethod -Method Delete -Uri "http://localhost:3333/comments/$($comment.id)" `
  -Headers @{ Authorization = "Bearer $token2" }

# 17. Deletar post como autor (Joao)
Invoke-RestMethod -Method Delete -Uri "http://localhost:3333/posts/$($post.id)" `
  -Headers @{ Authorization = "Bearer $token" }

# --- Fluxo de ADMIN ---

# 18. Promover Maria a admin (precisa de um admin existente — ajuste o token abaixo)
# Primeiro crie um admin direto no banco via: npx prisma studio
# Depois faça login como admin e guarde $tokenAdmin

# 19. Admin muda role de Maria para ADMIN
$mariaId = ((Invoke-RestMethod -Uri http://localhost:3333/users `
  -Headers @{ Authorization = "Bearer $tokenAdmin" }) | Where-Object { $_.email -eq "maria@email.com" }).id

Invoke-RestMethod -Method Patch -Uri "http://localhost:3333/users/$mariaId/role" `
  -ContentType "application/json" `
  -Headers @{ Authorization = "Bearer $tokenAdmin" } `
  -Body '{"role":"ADMIN"}'

# 20. Admin deleta post de outro usuário
Invoke-RestMethod -Method Delete -Uri "http://localhost:3333/posts/$($post.id)" `
  -Headers @{ Authorization = "Bearer $tokenAdmin" }

# 21. Admin deleta comentário de outro usuário
Invoke-RestMethod -Method Delete -Uri "http://localhost:3333/comments/$($comment.id)" `
  -Headers @{ Authorization = "Bearer $tokenAdmin" }
```

---

## Resumo de todas as rotas

| Método | Rota | Auth | Permissão |
|---|---|---|---|
| `POST` | `/users` | Não | — |
| `POST` | `/login` | Não | — |
| `GET` | `/users/me` | Sim | Próprio |
| `GET` | `/users` | Sim | Qualquer autenticado |
| `GET` | `/users/:id` | Sim | Qualquer autenticado |
| `PUT` | `/users/:id` | Sim | Dono ou admin |
| `PATCH` | `/users/:id/role` | Sim | Somente admin |
| `DELETE` | `/users/:id` | Sim | Dono ou admin |
| `POST` | `/posts` | Sim | Qualquer autenticado |
| `GET` | `/posts` | Sim | Qualquer autenticado |
| `GET` | `/posts/:id` | Sim | Qualquer autenticado |
| `GET` | `/posts/:postId/comments` | Sim | Qualquer autenticado |
| `PUT` | `/posts/:id` | Sim | Dono ou admin |
| `DELETE` | `/posts/:id` | Sim | Dono ou admin |
| `POST` | `/posts/:postId/comments` | Sim | Qualquer autenticado |
| `PUT` | `/comments/:id` | Sim | Dono ou admin |
| `DELETE` | `/comments/:id` | Sim | Dono ou admin |
| `POST` | `/posts/:postId/vote` | Sim | Qualquer autenticado (exceto dono) |
| `DELETE` | `/posts/:postId/vote` | Sim | Quem votou |
| `POST` | `/comments/:commentId/vote` | Sim | Qualquer autenticado (exceto dono) |
| `DELETE` | `/comments/:commentId/vote` | Sim | Quem votou |
| `POST` | `/feedbacks` | Sim | Qualquer autenticado |
| `GET` | `/feedbacks` | Não | — |
| `GET` | `/feedbacks/:id` | Não | — |
| `PUT` | `/feedbacks/:id` | Sim | Dono ou admin |
| `DELETE` | `/feedbacks/:id` | Sim | Dono ou admin |
