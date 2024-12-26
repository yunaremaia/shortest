'use server';

import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { users, type NewUser } from '@/lib/db/schema';
import { comparePasswords, hashPassword, setSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

const userSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(8).max(100),
});

export async function signIn(_: any, formData: FormData) {
  const result = userSchema.safeParse({
    username: formData.get('username'),
    password: formData.get('password'),
  });

  if (!result.success) {
    return { error: 'Invalid input. Please check your username and password.' };
  }

  const { username, password } = result.data;

  const user = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  if (user.length === 0) {
    return { error: 'User not found. Please try again.' };
  }

  const isPasswordValid = await comparePasswords(
    password,
    user[0].passwordHash,
  );

  if (!isPasswordValid) {
    return { error: 'Incorrect password. Please try again.' };
  }

  setSession(user[0]);
  redirect('/dashboard');
}

export async function signUp(_: any, formData: FormData) {
  const result = userSchema.safeParse({
    username: formData.get('username'),
    password: formData.get('password'),
  });

  if (!result.success) {
    return { error: 'Invalid input. Please check your username and password.' };
  }

  const { username, password } = result.data;

  const existingUser = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  if (existingUser.length > 0) {
    return { error: 'Username already exists.' };
  }

  const passwordHash = await hashPassword(password);

  const newUser: NewUser = {
    username,
    passwordHash,
  };

  await db.insert(users).values(newUser);

  setSession(existingUser[0]);
  redirect('/dashboard');
}

export async function signOut() {
  cookies().set('session', '', { expires: new Date(0) });
  revalidatePath('/', 'layout');
  redirect('/');
}
