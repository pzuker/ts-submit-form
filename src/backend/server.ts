import path from 'path';
import dotenv from 'dotenv';
import formBody from '@fastify/formbody';
import staticFiles from '@fastify/static';
import cookie from '@fastify/cookie';
import Fastify from 'fastify';
import type { FastifyReply } from 'fastify/types/reply';
import type { FastifyRequest } from 'fastify/types/request';
import nunjucks from 'nunjucks';
import { z } from 'zod';

import { clearFlashCookie, FLASH_MSG_COOKIE } from './flash';
import { comparePassword, hashPassword } from './auth';
import { connect, newDb, SqliteUserRepository, SqliteSession } from './db';
import { checkUsername } from '../shared/username-rules';
import { checkComplexity } from '../shared/password-rules';

dotenv.config();

const SESSION_COOKIE = 'SESSION_ID';

const environment = process.env['NODE_ENV'];
const cookieSecret = process.env['COOKIE_SECRET'];

if (cookieSecret === undefined) {
  console.error('must set COOKIE_SECRET environment variable');
  process.exit(1);
}

const templates = new nunjucks.Environment(
  new nunjucks.FileSystemLoader('src/backend/templates')
);
const USERS_DB = './users.sqlite';

const fastify = Fastify({ logger: true });

const accountCreateRquestSchema = z.object({
  email: z.string(),
  password: z.string(),
  agreedToTerms: z.string().optional(),
});

type AccountCreateRequest = z.infer<typeof accountCreateRquestSchema>;

const accountLoginRquestSchema = z.object({
  email: z.string(),
  password: z.string(),
  agreedToTerms: z.string().optional(),
});

type AccountLoginRequest = z.infer<typeof accountLoginRquestSchema>;

{
  fastify.register(formBody);
  fastify.register(cookie, {
    secret: cookieSecret,
  });

  fastify.register(clearFlashCookie); // middleware

  fastify.register(staticFiles, {
    root: path.join(__dirname, '../../dist'),
  });
}

function setFlashCookie(reply: FastifyReply, msg: string): void {
  reply.setCookie(FLASH_MSG_COOKIE, msg, {
    path: '/',
  });
}

function readFlashCookie(request: FastifyRequest): string | undefined {
  return request.cookies[FLASH_MSG_COOKIE];
}

function setSessionCookie(reply: FastifyReply, sessionId: string): void {
  reply.setCookie(SESSION_COOKIE, sessionId, {
    path: '/',
  });
}

function readSessionCookie(request: FastifyRequest): string | undefined {
  return request.cookies[SESSION_COOKIE];
}

fastify.get('/', async (request, reply) => {
  await reply.redirect('/signin');
});

fastify.get('/welcome', async (request, reply) => {
  const sessionId = readSessionCookie(request);
  if (sessionId === undefined) {
    setFlashCookie(reply, 'Please sign in to continue.');
    return await reply.redirect('/signin');
  }
  const db = await connect(USERS_DB);
  const sessions = new SqliteSession(db);
  const user = await sessions.get(sessionId);
  if (user === undefined) {
    setFlashCookie(
      reply,
      'Your session has expired. Please sign in to continue.'
    );
    return await reply.redirect('/signin');
  }

  const rendered = templates.render('welcome.njk', {
    environment,
    email: user.email,
  });
  return await reply
    .header('Content-Type', 'text/html; charset=utf-8')
    .send(rendered);
});

fastify.post('/account/signup', async (request, reply) => {
  let requestData: AccountCreateRequest;

  try {
    requestData = accountCreateRquestSchema.parse(request.body);
  } catch (error) {
    setFlashCookie(reply, 'There was an error processing your request.');
    return await reply.redirect('/signup');
  }

  if (requestData.agreedToTerms !== 'on') {
    setFlashCookie(reply, 'You must agree to the terms to sign up.');
    return await reply.redirect('/signup');
  }

  const usernameFailures = checkUsername(requestData.email);
  if (usernameFailures.length > 0) {
    const formattedErrors = usernameFailures.join('<br>');
    setFlashCookie(reply, formattedErrors);
    return await reply.redirect('/signup');
  }

  const passwordFailures = checkComplexity(requestData.password);
  if (passwordFailures.length > 0) {
    const formattedErrors = passwordFailures.join('<br>');
    setFlashCookie(reply, formattedErrors);
    return await reply.redirect('/signup');
  }

  const db = await connect(USERS_DB);
  const userRepository = new SqliteUserRepository(db);

  const hashedPassword = await hashPassword(requestData.password);

  try {
    const newUser = {
      ...requestData,
      id: 0,
      agreedToTerms: true,
      hashedPassword,
    };

    const user = await userRepository.create(newUser);

    const sessions = new SqliteSession(db);
    const sessionId = await sessions.create(user.id);
    setSessionCookie(reply, sessionId);

    return await reply.redirect('/welcome');
  } catch (error) {
    setFlashCookie(reply, 'That account already exists.');
    return await reply.redirect('/signup');
  }
});

fastify.get('/signup', async (request, reply) => {
  const serverMsg = readFlashCookie(request);
  const rendered = templates.render('signup.njk', {
    server_msg: serverMsg,
    environment,
  });
  return await reply
    .header('Content-Type', 'text/html; charset=utf-8')
    .send(rendered);
});

fastify.get('/signin', async (request, reply) => {
  const serverMsg = readFlashCookie(request);
  const rendered = templates.render('signin.njk', {
    server_msg: serverMsg,
    environment,
  });
  return await reply
    .header('Content-Type', 'text/html; charset=utf-8')
    .send(rendered);
});

fastify.post('/account/signin', async (request, reply) => {
  let requestData: AccountLoginRequest;

  try {
    requestData = accountLoginRquestSchema.parse(request.body);
  } catch (error) {
    setFlashCookie(reply, 'There was an error processing your request.');
    return await reply.redirect('/signin');
  }

  const db = await connect(USERS_DB);
  const userRepository = new SqliteUserRepository(db);

  try {
    const user = await userRepository.findByEmail(requestData.email);
    if (user === undefined) {
      setFlashCookie(reply, 'Invalid login credentials.');
      return await reply.redirect('/signin');
    }
    const passwordMatches = await comparePassword(
      requestData.password,
      user.hashedPassword
    );
    if (!passwordMatches) {
      setFlashCookie(reply, 'Invalid login credentials.');
      return await reply.redirect('/signin');
    }

    const sessions = new SqliteSession(db);
    const sessionId = await sessions.create(user.id);
    setSessionCookie(reply, sessionId);

    return await reply.redirect('/welcome');
  } catch (error) {
    setFlashCookie(reply, 'Invalid login credentials.');
    return await reply.redirect('/signin');
  }
});

const start = async (): Promise<void> => {
  try {
    const db = await connect(USERS_DB);
    newDb(db);
    await fastify.listen({ port: 8089 });
  } catch (error) {
    fastify.log.error(error);
    process.exit(1);
  }
};

start();
