# FeedbackHub API — Guia Completo

## O que é este projeto?

O **FeedbackHub** é uma API (interface de comunicação entre sistemas) que permite que usuários enviem feedbacks, sugestões ou relatos sobre qualquer coisa. Além disso, possui um sistema de posts com comentários e votos, onde os usuários ganham ou perdem karma conforme suas contribuições são avaliadas pela comunidade.

A API foi construída com:

- **Fastify** — framework que cria o servidor e as rotas HTTP
- **Prisma** — responsável por conversar com o banco de dados
- **SQLite** — banco de dados (um arquivo local, simples de usar)
- **JWT** — sistema de autenticação via token (como um crachá digital)
- **Zod** — validação dos dados enviados pelo usuário
- **TypeScript** — JavaScript com tipos, evita bugs comuns

---

## Como rodar o projeto

### Pré-requisitos

- Node.js versão 20 ou superior instalado
- Um terminal (PowerShell, CMD ou terminal do VS Code)

### Passo a passo

```bash
# 1. Instalar as dependências
npm install

# 2. Subir o servidor em modo desenvolvimento
npm run dev
```

O servidor vai iniciar em `http://localhost:3333` e restartar automaticamente quando você salvar algum arquivo.

### Outros comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Sobe o servidor com hot-reload (reinicia sozinho ao salvar) |
| `npm run build` | Gera a versão de produção na pasta `dist/` |
| `npm start` | Roda a versão de produção (precisa buildar antes) |
| `npm test` | Roda todos os testes automatizados |

---

## Como funciona a autenticação

Algumas rotas são **protegidas** — só funcionam se você estiver "logado". O sistema usa **JWT (JSON Web Token)**: ao fazer login, a API devolve um token (uma string longa). Você precisa enviar esse token no cabeçalho de cada requisição protegida.

```
Authorization: Bearer <seu_token_aqui>
```

Se não enviar o token (ou enviar um inválido), a API retorna:
```json
{ "message": "Não autorizado" }
```

### Papéis de usuário

Existem dois tipos de usuário no sistema:

| Papel | O que pode fazer |
|---|---|
| `USER` | Cria, edita e deleta os próprios feedbacks e posts; edita e deleta a própria conta; comenta e vota |
| `ADMIN` | Tudo que o USER pode, mais: alterar status de qualquer feedback, editar e deletar qualquer post ou comentário |

Todo usuário criado pelo endpoint `/users` começa como `USER`. Para promover alguém a `ADMIN`, é necessário alterar direto no banco de dados (funcionalidade administrativa futura).

---

## Sistema de Karma

Cada usuário tem um campo `karma` que representa a reputação acumulada na plataforma. O karma é atualizado automaticamente quando alguém vota nos posts ou comentários do usuário:

| Ação | Efeito no karma do autor |
|---|---|
| Recebe um upvote em post ou comentário | `+1` |
| Recebe um downvote em post ou comentário | `-1` |
| Voto é revertido (de up para down) | `-2` |
| Voto é revertido (de down para up) | `+2` |
| Voto é removido (upvote cancelado) | `-1` |
| Voto é removido (downvote cancelado) | `+1` |

**Regras dos votos:**
- Não é permitido votar no próprio post ou comentário
- Votar duas vezes com o mesmo valor não tem efeito (idempotente)
- Para cancelar um voto, use o método `DELETE` na rota de voto

---

## Estrutura de pastas

```
src/
├── controllers/     # Recebe a requisição HTTP e chama o service correto
├── services/        # Regras de negócio (quem pode fazer o quê)
├── repositories/    # Acesso ao banco de dados
├── routes/          # Define as URLs e quais controllers respondem por elas
├── schemas/         # Validação dos dados de entrada (Zod)
├── middlewares/     # Verificação do token JWT
├── utils/           # Classes de erro padronizadas
├── enums/           # Constantes (ex: UserRole)
├── lib/             # Configuração do Prisma
└── tests/           # Testes automatizados (57 testes)
```

---

## Rotas disponíveis

A base de todas as URLs é `http://localhost:3333`.

---

### Usuários

#### Criar conta

```
POST /users
```

Cria um novo usuário com papel `USER`.

**Body (JSON):**
```json
{
  "name": "Joao Silva",
  "email": "joao@email.com",
  "password": "123456"
}
```

**Regras:**
- `name` — mínimo 3 caracteres
- `email` — precisa ser um e-mail válido e único no sistema
- `password` — mínimo 6 caracteres (armazenada criptografada, nunca em texto puro)

**Resposta de sucesso (201):**
```json
{
  "id": "clx1abc...",
  "name": "Joao Silva",
  "email": "joao@email.com",
  "role": "USER"
}
```

**Erros possíveis:**
```json
{ "message": "Email já cadastrado" }           // 409
{ "message": "O nome deve ter no mínimo 3 caracteres" }  // 400
```

---

#### Login

```
POST /login
```

Autentica o usuário e retorna um token JWT.

**Body (JSON):**
```json
{
  "email": "joao@email.com",
  "password": "123456"
}
```

**Resposta de sucesso (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

> Guarde esse token — ele é necessário para todas as rotas protegidas.

**Erros possíveis:**
```json
{ "message": "Credenciais invalidas" }  // 401
```

---

#### Listar todos os usuários

```
GET /users
```

**Requer:** token JWT no cabeçalho

**Resposta de sucesso (200):**
```json
[
  {
    "id": "clx1abc...",
    "name": "Joao Silva",
    "email": "joao@email.com",
    "role": "USER",
    "karma": 0
  }
]
```

---

#### Buscar um usuário por ID

```
GET /users/:id
```

**Requer:** token JWT no cabeçalho

**Exemplo:** `GET /users/clx1abc...`

**Resposta de sucesso (200):**
```json
{
  "id": "clx1abc...",
  "name": "Joao Silva",
  "email": "joao@email.com",
  "role": "USER",
  "karma": 0,
  "createdAt": "2026-05-29T20:00:00.000Z"
}
```

**Erros possíveis:**
```json
{ "message": "Usuário não encontrado" }  // 404
```

---

#### Atualizar usuário

```
PUT /users/:id
```

**Requer:** token JWT | **Permissão:** próprio usuário ou admin

Atualiza nome, e-mail ou senha. Envie apenas os campos que deseja alterar.

**Body (JSON):**
```json
{
  "name": "Joao Atualizado",
  "email": "novoemail@email.com",
  "password": "novasenha123"
}
```

**Resposta de sucesso (200):** retorna o usuário atualizado

**Erros possíveis:**
```json
{ "message": "Usuário não encontrado" }              // 404
{ "message": "Sem permissão para atualizar este usuário" }  // 403
{ "message": "Email já cadastrado" }                 // 409
```

---

#### Deletar usuário

```
DELETE /users/:id
```

**Requer:** token JWT | **Permissão:** próprio usuário ou admin

**Resposta de sucesso:** `204 No Content` (sem corpo)

**Erros possíveis:**
```json
{ "message": "Usuário não encontrado" }             // 404
{ "message": "Sem permissão para deletar este usuário" }  // 403
```

---

### Feedbacks

#### Criar feedback

```
POST /feedbacks
```

**Requer:** token JWT

O autor do feedback é automaticamente o usuário autenticado.

**Body (JSON):**
```json
{
  "title": "Sugestão de melhoria",
  "description": "Seria ótimo ter um modo escuro no sistema"
}
```

**Regras:**
- `title` — mínimo 5 caracteres
- `description` — mínimo 10 caracteres

**Resposta de sucesso (201):**
```json
{
  "id": "clx2xyz...",
  "title": "Sugestão de melhoria",
  "description": "Seria ótimo ter um modo escuro no sistema",
  "status": "OPEN",
  "authorId": "clx1abc...",
  "createdAt": "2026-05-29T20:00:00.000Z",
  "updatedAt": "2026-05-29T20:00:00.000Z"
}
```

---

#### Listar feedbacks

```
GET /feedbacks
GET /feedbacks?status=OPEN
GET /feedbacks?status=IN_PROGRESS
GET /feedbacks?status=DONE
```

**Rota pública** — não precisa de token.

O parâmetro `status` é opcional. Sem ele, retorna todos os feedbacks.

**Status disponíveis:**

| Status | Significado |
|---|---|
| `OPEN` | Aberto, aguardando análise |
| `IN_PROGRESS` | Em andamento |
| `DONE` | Concluído |

**Resposta de sucesso (200):**
```json
[
  {
    "id": "clx2xyz...",
    "title": "Sugestão de melhoria",
    "description": "Seria ótimo ter um modo escuro no sistema",
    "status": "OPEN",
    "authorId": "clx1abc...",
    "createdAt": "2026-05-29T20:00:00.000Z",
    "updatedAt": "2026-05-29T20:00:00.000Z"
  }
]
```

---

#### Buscar feedback por ID

```
GET /feedbacks/:id
```

**Rota pública** — não precisa de token.

**Exemplo:** `GET /feedbacks/clx2xyz...`

**Resposta de sucesso (200):** retorna o objeto do feedback

**Erros possíveis:**
```json
{ "message": "Feedback não encontrado" }  // 404
```

---

#### Atualizar feedback

```
PUT /feedbacks/:id
```

**Requer:** token JWT

**Permissões:**
- **Dono do feedback** — pode alterar `title` e `description`
- **Admin** — pode alterar `title`, `description` e `status`

Envie apenas os campos que deseja alterar (pelo menos um é obrigatório).

**Body (JSON) — exemplo de usuário comum:**
```json
{
  "title": "Novo título",
  "description": "Descrição atualizada com mais detalhes"
}
```

**Body (JSON) — exemplo de admin mudando status:**
```json
{
  "status": "IN_PROGRESS"
}
```

**Resposta de sucesso (200):** retorna o feedback atualizado

**Erros possíveis:**
```json
{ "message": "Feedback não encontrado" }                    // 404
{ "message": "Sem permissão para editar este feedback" }    // 403
{ "message": "Apenas administradores podem alterar o status" }  // 403
{ "message": "Informe ao menos um campo para atualizar" }   // 400
```

---

#### Deletar feedback

```
DELETE /feedbacks/:id
```

**Requer:** token JWT | **Permissão:** dono do feedback ou admin

**Resposta de sucesso:** `204 No Content` (sem corpo)

**Erros possíveis:**
```json
{ "message": "Feedback não encontrado" }                   // 404
{ "message": "Sem permissão para deletar este feedback" }  // 403
```

---

### Posts

Os posts são publicações feitas pelos usuários. Cada post pode receber comentários e votos da comunidade, e o score do post sobe ou desce conforme os votos.

#### Criar post

```
POST /posts
```

**Requer:** token JWT

**Body (JSON):**
```json
{
  "title": "Meu primeiro post",
  "content": "Conteúdo detalhado do meu post aqui"
}
```

**Regras:**
- `title` — mínimo 3 caracteres
- `content` — mínimo 10 caracteres

**Resposta de sucesso (201):**
```json
{
  "id": "clx3abc...",
  "title": "Meu primeiro post",
  "content": "Conteúdo detalhado do meu post aqui",
  "userId": "clx1abc...",
  "score": 0,
  "createdAt": "2026-05-29T20:00:00.000Z",
  "updatedAt": "2026-05-29T20:00:00.000Z"
}
```

---

#### Listar posts

```
GET /posts
```

**Requer:** token JWT

Retorna todos os posts ordenados do mais recente para o mais antigo.

**Resposta de sucesso (200):**
```json
[
  {
    "id": "clx3abc...",
    "title": "Meu primeiro post",
    "content": "Conteúdo detalhado do meu post aqui",
    "userId": "clx1abc...",
    "score": 5,
    "createdAt": "2026-05-29T20:00:00.000Z",
    "updatedAt": "2026-05-29T20:00:00.000Z"
  }
]
```

---

#### Buscar post por ID

```
GET /posts/:id
```

**Requer:** token JWT

Retorna o post com todos os seus comentários incluídos, ordenados do mais antigo para o mais recente.

**Exemplo:** `GET /posts/clx3abc...`

**Resposta de sucesso (200):**
```json
{
  "id": "clx3abc...",
  "title": "Meu primeiro post",
  "content": "Conteúdo detalhado do meu post aqui",
  "userId": "clx1abc...",
  "score": 5,
  "createdAt": "2026-05-29T20:00:00.000Z",
  "updatedAt": "2026-05-29T20:00:00.000Z",
  "comments": [
    {
      "id": "clx4def...",
      "content": "Ótimo post!",
      "userId": "clx2bcd...",
      "postId": "clx3abc...",
      "score": 2,
      "createdAt": "2026-05-29T20:01:00.000Z",
      "updatedAt": "2026-05-29T20:01:00.000Z"
    }
  ]
}
```

**Erros possíveis:**
```json
{ "message": "Post não encontrado" }  // 404
```

---

#### Atualizar post

```
PUT /posts/:id
```

**Requer:** token JWT | **Permissão:** dono do post ou admin

Envie apenas os campos que deseja alterar (pelo menos um é obrigatório).

**Body (JSON):**
```json
{
  "title": "Título atualizado",
  "content": "Conteúdo atualizado com mais informações"
}
```

**Resposta de sucesso (200):** retorna o post atualizado

**Erros possíveis:**
```json
{ "message": "Post não encontrado" }               // 404
{ "message": "Sem permissão para editar este post" }  // 403
{ "message": "Informe ao menos um campo para atualizar" }  // 400
```

---

#### Deletar post

```
DELETE /posts/:id
```

**Requer:** token JWT | **Permissão:** dono do post ou admin

Deletar um post remove automaticamente todos os comentários e votos associados.

**Resposta de sucesso:** `204 No Content` (sem corpo)

**Erros possíveis:**
```json
{ "message": "Post não encontrado" }                  // 404
{ "message": "Sem permissão para deletar este post" }  // 403
```

---

### Comentários

#### Criar comentário

```
POST /posts/:postId/comments
```

**Requer:** token JWT

**Exemplo:** `POST /posts/clx3abc.../comments`

**Body (JSON):**
```json
{
  "content": "Ótimo post, concordo com tudo!"
}
```

**Regras:**
- `content` — mínimo 3 caracteres

**Resposta de sucesso (201):**
```json
{
  "id": "clx4def...",
  "content": "Ótimo post, concordo com tudo!",
  "userId": "clx1abc...",
  "postId": "clx3abc...",
  "score": 0,
  "createdAt": "2026-05-29T20:01:00.000Z",
  "updatedAt": "2026-05-29T20:01:00.000Z"
}
```

**Erros possíveis:**
```json
{ "message": "Post não encontrado" }  // 404
```

---

#### Atualizar comentário

```
PUT /comments/:id
```

**Requer:** token JWT | **Permissão:** dono do comentário ou admin

**Body (JSON):**
```json
{
  "content": "Comentário atualizado com correções"
}
```

**Resposta de sucesso (200):** retorna o comentário atualizado

**Erros possíveis:**
```json
{ "message": "Comentário não encontrado" }                    // 404
{ "message": "Sem permissão para editar este comentário" }    // 403
```

---

#### Deletar comentário

```
DELETE /comments/:id
```

**Requer:** token JWT | **Permissão:** dono do comentário ou admin

**Resposta de sucesso:** `204 No Content` (sem corpo)

**Erros possíveis:**
```json
{ "message": "Comentário não encontrado" }                   // 404
{ "message": "Sem permissão para deletar este comentário" }  // 403
```

---

### Votos

O sistema de votos permite avaliar posts e comentários. Cada usuário pode dar apenas um voto por post ou comentário. O voto atualiza o `score` do post/comentário e o `karma` do autor.

#### Votar em um post

```
POST /posts/:postId/vote
```

**Requer:** token JWT

**Body (JSON):**
```json
{ "value": true }
```

- `true` = upvote (positivo)
- `false` = downvote (negativo)

**Resposta de sucesso:** `204 No Content` (sem corpo)

**Erros possíveis:**
```json
{ "message": "Post não encontrado" }                          // 404
{ "message": "Não é permitido votar no próprio post" }        // 403
```

---

#### Remover voto de um post

```
DELETE /posts/:postId/vote
```

**Requer:** token JWT

Cancela o voto dado anteriormente e restaura o score.

**Resposta de sucesso:** `204 No Content` (sem corpo)

**Erros possíveis:**
```json
{ "message": "Post não encontrado" }   // 404
{ "message": "Voto não encontrado" }   // 404
```

---

#### Votar em um comentário

```
POST /comments/:commentId/vote
```

**Requer:** token JWT

**Body (JSON):**
```json
{ "value": true }
```

**Resposta de sucesso:** `204 No Content` (sem corpo)

**Erros possíveis:**
```json
{ "message": "Comentário não encontrado" }                          // 404
{ "message": "Não é permitido votar no próprio comentário" }        // 403
```

---

#### Remover voto de um comentário

```
DELETE /comments/:commentId/vote
```

**Requer:** token JWT

**Resposta de sucesso:** `204 No Content` (sem corpo)

**Erros possíveis:**
```json
{ "message": "Comentário não encontrado" }  // 404
{ "message": "Voto não encontrado" }        // 404
```

---

## Testando no terminal (PowerShell)

Abra **dois terminais**. No primeiro:

```powershell
npm run dev
```

No segundo, execute em sequência:

```powershell
# 1. Criar usuário
Invoke-RestMethod -Method Post -Uri http://localhost:3333/users `
  -ContentType "application/json" `
  -Body '{"name":"Joao Silva","email":"joao@email.com","password":"123456"}'

# 2. Login e guardar o token
$token = (Invoke-RestMethod -Method Post -Uri http://localhost:3333/login `
  -ContentType "application/json" `
  -Body '{"email":"joao@email.com","password":"123456"}').token

# 3. Criar feedback
$fb = Invoke-RestMethod -Method Post -Uri http://localhost:3333/feedbacks `
  -ContentType "application/json" `
  -Headers @{ Authorization = "Bearer $token" } `
  -Body '{"title":"Minha sugestao","description":"Seria otimo ter esse recurso"}'

# 4. Listar feedbacks (rota pública)
Invoke-RestMethod http://localhost:3333/feedbacks

# 5. Criar post
$post = Invoke-RestMethod -Method Post -Uri http://localhost:3333/posts `
  -ContentType "application/json" `
  -Headers @{ Authorization = "Bearer $token" } `
  -Body '{"title":"Meu post","content":"Conteudo detalhado do meu primeiro post aqui"}'

# 6. Comentar no post
$comment = Invoke-RestMethod -Method Post -Uri "http://localhost:3333/posts/$($post.id)/comments" `
  -ContentType "application/json" `
  -Headers @{ Authorization = "Bearer $token" } `
  -Body '{"content":"Que post interessante!"}'

# 7. Criar segundo usuário para votar
Invoke-RestMethod -Method Post -Uri http://localhost:3333/users `
  -ContentType "application/json" `
  -Body '{"name":"Maria","email":"maria@email.com","password":"123456"}'

$token2 = (Invoke-RestMethod -Method Post -Uri http://localhost:3333/login `
  -ContentType "application/json" `
  -Body '{"email":"maria@email.com","password":"123456"}').token

# 8. Votar no post (upvote)
Invoke-RestMethod -Method Post -Uri "http://localhost:3333/posts/$($post.id)/vote" `
  -ContentType "application/json" `
  -Headers @{ Authorization = "Bearer $token2" } `
  -Body '{"value":true}'

# 9. Votar no comentário (upvote)
Invoke-RestMethod -Method Post -Uri "http://localhost:3333/comments/$($comment.id)/vote" `
  -ContentType "application/json" `
  -Headers @{ Authorization = "Bearer $token2" } `
  -Body '{"value":true}'

# 10. Ver o post com comentários e score atualizado
Invoke-RestMethod -Method Get -Uri "http://localhost:3333/posts/$($post.id)" `
  -Headers @{ Authorization = "Bearer $token" }

# 11. Ver karma do usuário 1 (deve ser 2: 1 do post + 1 do comentário)
Invoke-RestMethod -Method Get -Uri http://localhost:3333/users `
  -Headers @{ Authorization = "Bearer $token" }
```

---

## Formato dos erros

Todos os erros seguem o mesmo formato:

```json
{ "message": "Descrição do erro aqui" }
```

| Código HTTP | Significado |
|---|---|
| `400` | Dados inválidos (validação falhou) |
| `401` | Não autenticado (token ausente ou inválido) |
| `403` | Sem permissão para esta ação |
| `404` | Recurso não encontrado |
| `409` | Conflito (ex: email já cadastrado) |
| `500` | Erro interno do servidor |

---

## Fluxo completo resumido

```
Usuário cria conta  →  faz login  →  recebe token
      ↓
Usa o token para criar feedbacks e posts
      ↓
Qualquer usuário autenticado pode ver posts e comentar
      ↓
Outros usuários votam nos posts e comentários
      ↓
O score do post/comentário sobe ou desce
O karma do autor é atualizado automaticamente
      ↓
Só o dono (ou admin) pode editar ou deletar seus recursos
Só admin pode mudar o status dos feedbacks
```

## Resumo das rotas

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| `POST` | `/users` | Não | Criar conta |
| `POST` | `/login` | Não | Fazer login |
| `GET` | `/users` | Sim | Listar usuários |
| `GET` | `/users/:id` | Sim | Buscar usuário |
| `PUT` | `/users/:id` | Sim (dono/admin) | Atualizar usuário |
| `DELETE` | `/users/:id` | Sim (dono/admin) | Deletar usuário |
| `POST` | `/feedbacks` | Sim | Criar feedback |
| `GET` | `/feedbacks` | Não | Listar feedbacks |
| `GET` | `/feedbacks/:id` | Não | Buscar feedback |
| `PUT` | `/feedbacks/:id` | Sim (dono/admin) | Atualizar feedback |
| `DELETE` | `/feedbacks/:id` | Sim (dono/admin) | Deletar feedback |
| `POST` | `/posts` | Sim | Criar post |
| `GET` | `/posts` | Sim | Listar posts |
| `GET` | `/posts/:id` | Sim | Buscar post (com comentários) |
| `PUT` | `/posts/:id` | Sim (dono/admin) | Atualizar post |
| `DELETE` | `/posts/:id` | Sim (dono/admin) | Deletar post |
| `POST` | `/posts/:postId/comments` | Sim | Criar comentário |
| `PUT` | `/comments/:id` | Sim (dono/admin) | Atualizar comentário |
| `DELETE` | `/comments/:id` | Sim (dono/admin) | Deletar comentário |
| `POST` | `/posts/:postId/vote` | Sim | Votar em post |
| `DELETE` | `/posts/:postId/vote` | Sim | Remover voto de post |
| `POST` | `/comments/:commentId/vote` | Sim | Votar em comentário |
| `DELETE` | `/comments/:commentId/vote` | Sim | Remover voto de comentário |
