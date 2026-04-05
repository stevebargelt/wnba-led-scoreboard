import { test as base, expect, Page } from '@playwright/test';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

type AuthFixtures = {
  supabase: SupabaseClient;
  authenticatedPage: Page;
};

export const test = base.extend<AuthFixtures>({
  supabase: async ({}, use) => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    await use(supabase);
  },

  authenticatedPage: async ({ page, supabase }, use) => {
    const testEmail = process.env.TEST_USER_EMAIL;
    const testPassword = process.env.TEST_USER_PASSWORD;

    if (!testEmail || !testPassword) {
      throw new Error('Missing test user credentials');
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    if (error) {
      throw new Error(`Failed to authenticate test user: ${error.message}`);
    }

    await page.context().addCookies([
      {
        name: 'sb-access-token',
        value: data.session.access_token,
        domain: 'localhost',
        path: '/',
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
      },
      {
        name: 'sb-refresh-token',
        value: data.session.refresh_token,
        domain: 'localhost',
        path: '/',
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
      },
    ]);

    await use(page);

    await supabase.auth.signOut();
  },
});

export { expect };
