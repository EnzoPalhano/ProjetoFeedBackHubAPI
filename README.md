# Feedback Hub API Foundation

Base técnica de uma API REST para uma plataforma de comunidade/feedback. Este repositório implementa somente o domínio de usuários e já deixa a arquitetura pronta para receber `posts`, `comments` e `votes` sem acoplamento indevido entre transporte HTTP, regras de negócio e persistência.

## Objetivo da fundação

- Implementar `POST /users` para cadastro.
- Implementar `POST /login` para emissao de JWT.
- Implementar `GET /users` para listagem protegida por JWT.
- Garantir validação de entrada com Zod.
- Persistir dados com Prisma ORM 6 sobre SQLite.
- Manter o acesso ao banco encapsulado por `Repository Pattern`.
- Deixar contratos, tipagem e camadas prontas para expansão de domínio.

## Aderência ao documento

O material do projeto nomeia explicitamente, na modelagem da classe `User`, os métodos:

- `createUser()`
- `login()`
- `viewProfile()`
- `updateProfile()`

Nesta entrega, somente o que foi pedido foi implementado:

- `createUser()` como caso de uso real de cadastro
- `login()` como autenticacao por e-mail e senha
- listagem de usuários autenticada via `GET /users`

Os demais comportamentos do documento continuam apenas previstos arquiteturalmente e não foram implementados para não fugir do escopo.

## Stack

- Node.js
- TypeScript com `strict: true` e `noImplicitAny: true`
- Fastify
- Prisma ORM v6
- SQLite
- Zod
- JWT via `@fastify/jwt`
- `bcryptjs`
- Vitest
- tsup
- ESLint
- Prettier
- dotenv

## Estrutura de diretórios

```text
.
├── db/
│   └── database.sqlite
├── prisma/
│   └── schema.prisma
├── src/
│   ├── app.ts
│   ├── env.ts
│   ├── server.ts
│   ├── controllers/
│   │   └── user.controller.ts
│   ├── enums/
│   │   └── user-role.ts
│   ├── lib/
│   │   └── prisma.ts
│   ├── middlewares/
│   │   └── verify-jwt.ts
│   ├── repositories/
│   │   ├── prisma-user-repository.ts
│   │   └── user-repository.ts
│   ├── routes/
│   │   └── users.ts
│   ├── schemas/
│   │   ├── create-user.schema.ts
│   │   └── login.schema.ts
│   ├── services/
│   │   └── user.service.ts
│   ├── tests/
│   │   └── users.spec.ts
│   ├── types/
│   │   └── fastify.d.ts
│   └── utils/
│       └── app-error.ts
├── .env
├── .env.example
├── .eslintrc.cjs
├── .prettierrc.json
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## Arquitetura

### 1. Fluxo por camadas

```text
Route
  -> Controller
    -> Service
      -> Repository (interface)
        -> Prisma Repository (implementation)
          -> Prisma Client
            -> SQLite
```

### 2. Responsabilidades

- `routes/`: wiring HTTP, middlewares e composição das dependências.
- `controllers/`: adaptação entre Fastify e casos de uso.
- `services/`: regras de negócio e orquestração.
- `repositories/`: contratos de persistência e implementação concreta.
- `schemas/`: validação e normalização de entrada.
- `middlewares/`: políticas transversais, como autenticação.
- `lib/`: adaptadores de infraestrutura compartilhados.
- `types/`: augmentation de tipos do Fastify/JWT.
- `utils/`: erros de aplicação e utilitários internos.

### 3. Por que Repository Pattern aqui

O serviço não conhece Prisma. Isso evita que futuras mudanças de persistência ou otimizações de consulta contaminem a regra de negócio. Quando `posts`, `comments` e `votes` forem adicionados, o time poderá repetir o mesmo padrão por agregado:

- contrato em `repositories/`
- implementação concreta em Prisma
- service desacoplado de detalhes de ORM

### 4. Nomes de métodos implementados

Para manter o código coerente com a documentação e evitar métodos genéricos demais:

- `UserService.createUser()`
- `UserService.login()`
- `UserService.listUsers()`
- `UserRepository.createUser()`
- `UserRepository.findUserByEmail()`
- `UserRepository.listUsers()`

## Modelo de dados

### Prisma schema

```prisma
enum UserRole {
  USER
  ADMIN
}

model User {
  id           String   @id @default(cuid())
  name         String
  email        String   @unique
  passwordHash String
  role         UserRole @default(USER)
  karma        Int      @default(0)
  createdAt    DateTime @default(now())
}
```

### Observações de modelagem

- `id` usa `cuid()` para manter identificadores estáveis e URL-safe.
- `email` possui `@unique`, reforçando a regra de unicidade também no banco.
- `passwordHash` é persistido isoladamente e jamais retorna na API.
- `role` já está pronto para políticas futuras de autorização.
- `karma` existe como campo preparado para evolução posterior, mas sem automação neste escopo.

## Segurança mínima implementada

- Senha criptografada com `bcryptjs`.
- Login gera JWT para acesso a endpoints protegidos.
- `GET /users` protegido com JWT.
- Tipagem do payload JWT estendida em `src/types/fastify.d.ts`.
- Respostas da API nunca expõem `passwordHash`.
- Validação de payload ocorre antes da execução do service.
- Tratamento padronizado de erro evita vazamento desnecessário de detalhes internos.

## Endpoints

### `POST /users`

Cria um usuário.

#### Request body

```json
{
  "name": "João",
  "email": "joao@email.com",
  "password": "123456"
}
```

#### Regras de validação

- `name`: string, mínimo de 3 caracteres após `trim`
- `email`: formato válido, normalizado com `trim` + `toLowerCase`
- `password`: string, mínimo de 6 caracteres

#### Response `201`

```json
{
  "id": "cm123...",
  "name": "João",
  "email": "joao@email.com",
  "role": "USER"
}
```

### `GET /users`

Lista usuários cadastrados.

#### Headers

```http
Authorization: Bearer <jwt>
```

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

### `POST /login`

Autentica um usuario e devolve um token JWT.

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
  "token": "jwt-token-aqui"
}
```

## Tratamento de erros

Formato padrão:

```json
{
  "message": "Mensagem descritiva"
}
```

Mapeamentos atuais:

- `400`: falha de validação Zod
- `401`: ausencia de JWT, JWT invalido ou credenciais invalidas
- `409`: e-mail duplicado
- `500`: erro interno não tratado

## JWT

O projeto registra `@fastify/jwt` no bootstrap da aplicação e tipa o payload como:

```ts
{
  sub: string;
  role: UserRole;
}
```

Isso permite que futuras features façam autorização com base em `role` sem reestruturar o contrato de autenticação.

## Prisma e SQLite

### Variáveis de ambiente

```env
DATABASE_URL="file:../db/database.sqlite"
JWT_SECRET=your-very-strong-secret
PORT=3333
NODE_ENV=development
```

### Bootstrap do banco

1. Instale dependências.
2. Gere o client Prisma.
3. Sincronize o schema com o SQLite.

Comandos:

```bash
npm install
npx prisma generate
npx prisma db push
```

O script de teste já executa `prisma db push --skip-generate` antes da suíte para garantir a existência do schema.

## Scripts

```json
{
  "dev": "build incremental com tsup e execução do servidor compilado",
  "build": "gera dist/",
  "start": "executa a build em produção",
  "test": "sincroniza schema e roda Vitest",
  "test:watch": "sincroniza schema e inicia Vitest watch",
  "lint": "executa ESLint",
  "postinstall": "gera Prisma Client automaticamente"
}
```

## Estratégia de testes

Os testes usam `Fastify.inject()` para evitar dependência de porta TCP e cobrem o comportamento HTTP real da app:

- criação de usuário com persistência
- rejeição de e-mail duplicado
- rejeição de payload inválido
- login com credenciais validas
- rejeicao de login invalido
- proteção do `GET /users` sem token
- sucesso do `GET /users` com JWT válido

### Observação importante

A suíte limpa a tabela `User` entre cenários com `prisma.user.deleteMany()`. Isso garante isolamento sem introduzir uma camada extra de fixtures ainda desnecessária para a fundação.

## Extensão futura recomendada

Ao adicionar `posts`, `comments` e `votes`, mantenha o mesmo padrão:

1. Criar schema Zod por caso de uso.
2. Criar controller fino.
3. Criar service contendo apenas regra de negócio.
4. Criar interface de repositório.
5. Criar implementação Prisma correspondente.
6. Registrar rotas no módulo dedicado.

### Diretrizes para não degradar a arquitetura

- Não acessar Prisma diretamente em services.
- Não validar regra de negócio dentro de controllers.
- Não retornar entidades persistidas sem DTO explícito.
- Não reutilizar `request.user` sem tipar o payload necessário.
- Não misturar autorização com persistência.

## Decisões intencionais

- Não há refresh token, ACL administrativa, upload ou módulos de comunidade além de `users`.
- Não há migrations versionadas ainda; para a fundação, `db push` reduz atrito inicial. Em ambiente de equipe, o passo natural seguinte é introduzir `prisma migrate dev`.
- O repositório concreto usa o `PrismaClient` compartilhado de `src/lib/prisma.ts` para evitar instâncias duplicadas do client.
- O `enum` de papel do usuário é reexportado de `@prisma/client` em `src/enums/user-role.ts`, centralizando o ponto de consumo do domínio.

## Checklist de conformidade com o escopo

- `POST /users`
- `POST /login`
- `GET /users`
- Fastify
- Prisma ORM 6
- SQLite em `db/database.sqlite`
- Zod
- JWT
- `bcryptjs`
- Repository Pattern
- Tipagem forte
- Enum de papéis
- Testes automatizados com Vitest
- Erros padronizados
- Hash de senha
- Endpoint protegido
- Estrutura pronta para crescimento
