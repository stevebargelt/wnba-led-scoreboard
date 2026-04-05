import { test, expect } from './fixtures/auth';

test.describe('Authenticated Tests', () => {
  test.skip('should access protected routes when authenticated', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');
    await expect(authenticatedPage).not.toHaveURL(/.*login.*/);
  });

  test.skip('should have access to user session', async ({ authenticatedPage, supabase }) => {
    const { data: { session } } = await supabase.auth.getSession();
    expect(session).not.toBeNull();
    expect(session?.user).toBeDefined();
  });
});
