# Feedback Hub API

API REST para uma plataforma de feedback de comunidade. Permite que usuários se cadastrem, autentiquem e enviem feedbacks, com controle de permissões por papel (`USER` / `ADMIN`).

## Stack

- Node.js 20+
- TypeScript com `strict: true`, `noImplicitAny: true` e `exactOptionalPropertyTypes: true`
- Fastify
- Prisma ORM v6
- SQLite
- Zod
- JWT via `@fastify/jwt`
- `bcryptjs`
- Vitest
- tsup
- ESLint + Prettier
- dotenv

## Estrutura de diretórios

```text
.
├── db/
│   └── database.sqlite
├── prisma/
│   ├── migrations/
│   └── schema.prisma
├── src/
│   ├── app.ts
│   ├── env.ts
│   ├── server.ts
│   ├── controllers/
│   │   ├── user.controller.ts
│   │   └── feedback.controller.ts
│   ├── enums/
│   │   └── user-role.ts
│   ├── lib/
│   │   └── prisma.ts
│   ├── middlewares/
│   │   └── verify-jwt.ts
│   ├── repositories/
│   │   ├── user-repository.ts
│   │   ├── prisma-user-repository.ts
│   │   ├── feedback-repository.ts
│   │   └── prisma-feedback-repository.ts
│   ├── routes/
│   │   ├── users.ts
│   │   └── feedbacks.ts
│   ├── schemas/
│   │   ├── create-user.schema.ts
│   │   ├── login.schema.ts
│   │   ├── update-user.schema.ts
│   │   ├── create-feedback.schema.ts
│   │   └── update-feedback.schema.ts
│   ├── services/
│   │   ├── user.service.ts
│   │   └── feedback.service.ts
│   ├── tests/
│   │   ├── users.spec.ts
│   │   └── feedbacks.spec.ts
│   ├── types/
│   │   └── fastify.d.ts
│   └── utils/
│       └── app-error.ts
├── .env
├── .eslintrc.cjs
├── .prettierrc.json
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## Arquitetura

### Fluxo por camadas

```text
Route
  -> Controller
    -> Service
      -> Repository (interface)
        -> Prisma Repository (implementation)
          -> Prisma Client
            -> SQLite
```

### Responsabilidades

- `routes/` — wiring HTTP, middlewares e composição das dependências
- `controllers/` — adaptação entre Fastify e casos de uso
- `services/` — regras de negócio e orquestração
- `repositories/` — contratos de persistência e implementação concreta
- `schemas/` — validação e normalização de entrada (Zod)
- `middlewares/` — políticas transversais como autenticação
- `lib/` — adaptadores de infraestrutura compartilhados
- `types/` — augmentation de tipos do Fastify/JWT
- `utils/` — erros de aplicação padronizados

### Por que Repository Pattern

O service não conhece Prisma. Isso evita que mudanças de persistência contaminem a regra de negócio. Cada domínio segue o mesmo padrão: contrato em `repositories/`, implementação concreta em Prisma, service desacoplado de detalhes de ORM.

## Modelo de dados

```prisma
enum UserRole {
  USER
  ADMIN
}

enum FeedbackStatus {
  OPEN
  IN_PROGRESS
  DONE
}

model User {
  id           String     @id @default(cuid())
  name         String
  email        String     @unique
  passwordHash String
  role         UserRole   @default(USER)
  karma        Int        @default(0)
  createdAt    DateTime   @default(now())
  feedbacks    Feedback[]
}

model Feedback {
  id          String         @id @default(cuid())
  title       String
  description String
  status      FeedbackStatus @default(OPEN)
  authorId    String
  author      User           @relation(fields: [authorId], references: [id], onDelete: Cascade)
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt
}
```

### Observações de modelagem

- `id` usa `cuid()` para identificadores estáveis e URL-safe.
- `email` possui `@unique`, reforçando a regra também no banco.
- `passwordHash` jamais retorna na API.
- `role` controla as políticas de autorização.
- `karma` existe como campo preparado para evolução, sem automação neste escopo.
- `onDelete: Cascade` garante que feedbacks sejam removidos ao deletar o autor.
- `updatedAt` é gerenciado automaticamente pelo Prisma.

## Variáveis de ambiente

```env
DATABASE_URL="file:../db/database.sqlite"
JWT_SECRET=your-very-strong-secret
PORT=3333
NODE_ENV=development
```

## Scripts

| Script | O que faz |
|---|---|
| `npm run dev` | Build incremental com tsup e hot-reload |
| `npm run build` | Gera `dist/` para produção |
| `npm start` | Executa a build de produção |
| `npm test` | Sincroniza schema e roda Vitest |
| `npm run test:watch` | Sincroniza schema e inicia Vitest em modo watch |
| `npm run lint` | Executa ESLint |

## Bootstrap do banco

```bash
npm install
npx prisma generate
npx prisma db push
```

O script de teste já executa `prisma db push --skip-generate` antes da suíte.

## Autenticação

Rotas protegidas exigem o token JWT no cabeçalho:

```http
Authorization: Bearer <token>
```

O payload do token carrega `sub` (id do usuário) e `role`. Respostas sem token ou com token inválido retornam `401`.

### Papéis

| Papel | Permissões |
|---|---|
| `USER` | Cria feedbacks; edita e deleta os próprios feedbacks e a própria conta |
| `ADMIN` | Tudo do USER, mais: alterar status de qualquer feedback e gerenciar qualquer conta |

Todo usuário criado via `POST /users` começa como `USER`.

---

## Endpoints — Usuários

### `POST /users`

Cria um novo usuário.

#### Request body

```json
{
  "name": "João",
  "email": "joao@email.com",
  "password": "123456"
}
```

#### Validação

| Campo | Regra |
|---|---|
| `name` | string, mínimo 3 caracteres após trim |
| `email` | formato válido, trim + toLowerCase, único no sistema |
| `password` | string, mínimo 6 caracteres |

#### Response `201`

```json
{
  "id": "cm123...",
  "name": "João",
  "email": "joao@email.com",
  "role": "USER"
}
```

#### Erros

| Código | Mensagem |
|---|---|
| `400` | Mensagem de validação do campo inválido |
| `409` | `Email já cadastrado` |

---

### `POST /login`

Autentica e retorna um token JWT.

#### Request body

```json
{
  "email": "joao@email.com",
  "password": "123456"
}
```

#### Response `200`

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### Erros

| Código | Mensagem |
|---|---|
| `401` | `Credenciais invalidas` |

---

### `GET /users`

Lista todos os usuários. **Requer JWT.**

#### Response `200`

```json
[
  {
    "id": "cm123...",
    "name": "João",
    "email": "joao@email.com",
    "role": "USER",
    "karma": 0
  }
]
```

---

### `GET /users/:id`

Retorna um usuário pelo ID. **Requer JWT.**

#### Response `200`

```json
{
  "id": "cm123...",
  "name": "João",
  "email": "joao@email.com",
  "role": "USER",
  "karma": 0,
  "createdAt": "2026-05-29T20:00:00.000Z"
}
```

#### Erros

| Código | Mensagem |
|---|---|
| `404` | `Usuário não encontrado` |

---

### `PUT /users/:id`

Atualiza nome, e-mail ou senha. **Requer JWT. Permissão: próprio usuário ou admin.**

Envie apenas os campos que deseja alterar (mínimo um).

#### Request body

```json
{
  "name": "João Atualizado",
  "email": "novo@email.com",
  "password": "novasenha123"
}
```

#### Validação

| Campo | Regra |
|---|---|
| `name` | opcional, mínimo 3 caracteres após trim |
| `email` | opcional, formato válido |
| `password` | opcional, mínimo 6 caracteres |

#### Response `200`

Retorna o usuário atualizado (mesmo formato do `GET /users/:id`).

#### Erros

| Código | Mensagem |
|---|---|
| `400` | `Informe ao menos um campo para atualizar` |
| `403` | `Sem permissão para atualizar este usuário` |
| `404` | `Usuário não encontrado` |
| `409` | `Email já cadastrado` |

---

### `DELETE /users/:id`

Remove um usuário. **Requer JWT. Permissão: próprio usuário ou admin.**

Ao deletar um usuário, todos os seus feedbacks são removidos automaticamente (`onDelete: Cascade`).

#### Response `204`

Sem corpo.

#### Erros

| Código | Mensagem |
|---|---|
| `403` | `Sem permissão para deletar este usuário` |
| `404` | `Usuário não encontrado` |

---

## Endpoints — Feedbacks

### `POST /feedbacks`

Cria um feedback. **Requer JWT.** O autor é definido automaticamente pelo token.

#### Request body

```json
{
  "title": "Sugestão de melhoria",
  "description": "Seria ótimo ter um modo escuro no sistema"
}
```

#### Validação

| Campo | Regra |
|---|---|
| `title` | string, mínimo 5 caracteres após trim |
| `description` | string, mínimo 10 caracteres após trim |

#### Response `201`

```json
{
  "id": "cm456...",
  "title": "Sugestão de melhoria",
  "description": "Seria ótimo ter um modo escuro no sistema",
  "status": "OPEN",
  "authorId": "cm123...",
  "createdAt": "2026-05-29T20:00:00.000Z",
  "updatedAt": "2026-05-29T20:00:00.000Z"
}
```

---

### `GET /feedbacks`

Lista feedbacks. **Rota pública.** Aceita filtro opcional por status.

#### Query params

| Parâmetro | Valores aceitos |
|---|---|
| `status` | `OPEN`, `IN_PROGRESS`, `DONE` |

Exemplos:
```
GET /feedbacks
GET /feedbacks?status=OPEN
GET /feedbacks?status=IN_PROGRESS
GET /feedbacks?status=DONE
```

#### Response `200`

Array de feedbacks, ordenados do mais recente ao mais antigo.

---

### `GET /feedbacks/:id`

Retorna um feedback pelo ID. **Rota pública.**

#### Response `200`

```json
{
  "id": "cm456...",
  "title": "Sugestão de melhoria",
  "description": "Seria ótimo ter um modo escuro no sistema",
  "status": "OPEN",
  "authorId": "cm123...",
  "createdAt": "2026-05-29T20:00:00.000Z",
  "updatedAt": "2026-05-29T20:00:00.000Z"
}
```

#### Erros

| Código | Mensagem |
|---|---|
| `404` | `Feedback não encontrado` |

---

### `PUT /feedbacks/:id`

Atualiza um feedback. **Requer JWT.**

#### Permissões por campo

| Campo | USER (dono) | ADMIN |
|---|---|---|
| `title` | ✅ | ✅ |
| `description` | ✅ | ✅ |
| `status` | ❌ | ✅ |

Não-donos (sem ser admin) recebem `403` em qualquer tentativa.

#### Request body

```json
{
  "title": "Novo título",
  "description": "Descrição atualizada",
  "status": "IN_PROGRESS"
}
```

Envie apenas os campos que deseja alterar (mínimo um).

#### Validação

| Campo | Regra |
|---|---|
| `title` | opcional, mínimo 5 caracteres após trim |
| `description` | opcional, mínimo 10 caracteres após trim |
| `status` | opcional, um de: `OPEN`, `IN_PROGRESS`, `DONE` |

#### Response `200`

Retorna o feedback atualizado.

#### Erros

| Código | Mensagem |
|---|---|
| `400` | `Informe ao menos um campo para atualizar` |
| `403` | `Sem permissão para editar este feedback` |
| `403` | `Apenas administradores podem alterar o status` |
| `404` | `Feedback não encontrado` |

---

### `DELETE /feedbacks/:id`

Remove um feedback. **Requer JWT. Permissão: dono do feedback ou admin.**

#### Response `204`

Sem corpo.

#### Erros

| Código | Mensagem |
|---|---|
| `403` | `Sem permissão para deletar este feedback` |
| `404` | `Feedback não encontrado` |

---

## Tratamento de erros

Formato padrão de todas as respostas de erro:

```json
{
  "message": "Mensagem descritiva"
}
```

| Código | Significado |
|---|---|
| `400` | Falha de validação Zod ou campo faltando |
| `401` | Token ausente, inválido, expirado ou credenciais erradas |
| `403` | Autenticado, mas sem permissão para a ação |
| `404` | Recurso não encontrado |
| `409` | Conflito (e-mail já cadastrado) |
| `500` | Erro interno não tratado |

## JWT

Payload tipado em `src/types/fastify.d.ts`:

```ts
{
  sub: string;   // id do usuário
  role: UserRole;
}
```

## Estratégia de testes

Os testes usam `Fastify.inject()` para evitar dependência de porta TCP e cobrem o comportamento HTTP real da app. Os arquivos de teste rodam **em série** (`fileParallelism: false` no `vitest.config.ts`) por compartilharem o mesmo banco SQLite.

### Cobertura atual

**`users.spec.ts`**
- Criação de usuário com persistência
- Rejeição de e-mail duplicado
- Rejeição de payload inválido
- Login com credenciais válidas
- Rejeição de login inválido
- Proteção do `GET /users` sem token
- Listagem autenticada

**`feedbacks.spec.ts`**
- Criação autenticada
- Rejeição sem token
- Rejeição de payload inválido
- Listagem pública
- Filtro por status
- Busca por ID e 404
- Atualização pelo dono
- Rejeição de atualização por não-dono (403)
- Rejeição de alteração de status por não-admin (403)
- Alteração de status por admin
- Exclusão pelo dono
- Rejeição de exclusão por não-dono (403)
- Exclusão por admin

## Segurança implementada

- Senha criptografada com `bcryptjs` (12 rounds)
- JWT com payload tipado e verificação via middleware
- `passwordHash` nunca retorna na API
- Validação de payload antes da execução do service
- Autorização por papel em operações sensíveis
- Erros padronizados sem vazamento de detalhes internos

## Checklist de conformidade

- `POST /users`
- `POST /login`
- `GET /users`
- `GET /users/:id`
- `PUT /users/:id`
- `DELETE /users/:id`
- `POST /feedbacks`
- `GET /feedbacks`
- `GET /feedbacks?status=`
- `GET /feedbacks/:id`
- `PUT /feedbacks/:id`
- `DELETE /feedbacks/:id`
- Fastify
- Prisma ORM 6
- SQLite
- Zod
- JWT
- `bcryptjs`
- Repository Pattern
- Tipagem forte com strict mode
- Enum de papéis (`USER` / `ADMIN`)
- Enum de status (`OPEN` / `IN_PROGRESS` / `DONE`)
- Testes automatizados com Vitest
- Erros padronizados
- Hash de senha
- Endpoints protegidos por JWT
- Autorização por papel
