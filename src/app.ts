/* 

NÃO ALTERA NADA AQUI SE VOCE NÃO SABE OQ É , OS COMENTARIOS SÃO SÓ PRA GUIAR , SE TA COMENTADO NÃO MEXE EM NADA 

Rafael

*/




// Excecao especifica do Prisma usada para identificar erros conhecidos do banco.
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
// Plugin que adiciona suporte a autenticacao JWT no Fastify.
import jwt from '@fastify/jwt';
// Fastify cria a aplicacao HTTP; FastifyError tipa erros internos do framework.
import Fastify, { type FastifyError } from 'fastify';
// ZodError representa falhas de validacao disparadas pelos schemas.
import { ZodError } from 'zod';

// Configuracoes de ambiente ja validadas no bootstrap da aplicacao.
import { env } from './env';
// Cliente Prisma compartilhado para acesso ao banco de dados.
import { prisma } from './lib/prisma';
// Modulo responsavel pelas rotas de usuarios.
import { usersRoutes } from './routes/users';
// Modulo responsavel pelas rotas de feedbacks.
import { feedbacksRoutes } from './routes/feedbacks';
// Erro base da aplicacao para respostas controladas de negocio.
import { AppError } from './utils/app-error';

// Conjunto com os codigos de erro do plugin JWT que devem ser tratados como 401.
const unauthorizedErrorCodes = new Set([
  'FST_JWT_AUTHORIZATION_TOKEN_EXPIRED',
  'FST_JWT_AUTHORIZATION_TOKEN_INVALID',
  'FST_JWT_AUTHORIZATION_TOKEN_UNTRUSTED',
  'FST_JWT_BAD_REQUEST',
  'FST_JWT_NO_AUTHORIZATION_IN_HEADER',
  'FST_JWT_NO_AUTHORIZATION_IN_COOKIE'
]);

// Funcao auxiliar para descobrir se o erro recebido foi causado por autenticacao invalida.
function isUnauthorizedFastifyJwtError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const e = error as FastifyError;
  if (e.statusCode === 401) return true;
  return typeof e.code === 'string' && unauthorizedErrorCodes.has(e.code);
}

// Esta factory monta e devolve a instancia principal da aplicacao Fastify.
export function buildApp() {
  // Cria o servidor HTTP; em teste, o logger e desligado para manter a saida limpa.
  const app = Fastify({
    logger: env.NODE_ENV !== 'test'
  });

  // Anexa o Prisma na instancia do Fastify para acesso centralizado dentro da app.
  app.decorate('prisma', prisma);

  // Registra o plugin de JWT usando a chave secreta configurada no ambiente.
  app.register(jwt, {
    secret: env.JWT_SECRET
  });

  // Garante encerramento limpo da conexao com o banco quando a app for fechada.
  app.addHook('onClose', async (instance) => {
    // So desconecta se a instancia registrada for exatamente a compartilhada.
    if (instance.prisma === prisma) {
      await instance.prisma.$disconnect();
    }
  });

  // Registra todas as rotas do modulo de usuarios.
  app.register(usersRoutes);
  // Registra todas as rotas do modulo de feedbacks.
  app.register(feedbacksRoutes);

  // Centraliza o tratamento de erros para a API responder sempre no mesmo formato.
  app.setErrorHandler((error, _request, reply) => {
    // Erros de negocio da propria aplicacao respeitam o status code definido neles.
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({ message: error.message });
    }

    // Falhas de validacao do Zod retornam 400 com a primeira mensagem relevante.
    if (error instanceof ZodError) {
      return reply
        .status(400)
        .send({ message: error.issues[0]?.message ?? 'Dados inválidos' });
    }

    // P2002 no Prisma indica violacao de unicidade; aqui tratamos o email duplicado.
    if (
      error instanceof PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return reply.status(409).send({ message: 'Email já cadastrado' });
    }

    // Erros de autenticacao JWT recebem resposta 401 padronizada.
    if (isUnauthorizedFastifyJwtError(error)) {
      return reply.status(401).send({ message: 'Não autorizado' });
    }

    // Qualquer erro inesperado e registrado para facilitar debug e observabilidade.
    app.log.error(error);

    // A resposta final permanece generica para nao expor detalhes internos.
    return reply.status(500).send({ message: 'Erro interno do servidor' });
  });

  // Entrega a aplicacao pronta para ser usada pelo server.ts e pelos testes.
  return app;
}
