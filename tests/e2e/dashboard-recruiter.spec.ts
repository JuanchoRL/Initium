import { expect, test } from '@playwright/test';

test.describe('dashboard recruiter/candidate views', () => {
  test('recruiter view muestra bloques de decision e insights', async ({ page }) => {
    await page.goto('/?debug_stage=results&debug_access=recruiter');

    await expect(page.getByText('Modo recruiter')).toBeVisible();
    await expect(page.getByTestId('recruiter-insights')).toBeVisible();
    await expect(page.getByTestId('recruiter-decision-card')).toBeVisible();
    await expect(page.getByTestId('recruiter-quickview-grid')).toBeVisible();
    await expect(page.getByTestId('recruiter-strengths')).toBeVisible();
    await expect(page.getByTestId('recruiter-risks')).toBeVisible();
    await expect(page.getByTestId('recruiter-interview-focus')).toBeVisible();
    await expect(page.getByTestId('recruiter-kpi-1')).toBeVisible();
    await expect(page.getByTestId('recruiter-insights-hint')).toBeVisible();
    await expect(page.getByTestId('recruiter-score-legend')).toBeVisible();
    await expect(page.getByTestId('signal-quality-card')).toBeVisible();
    await expect(page.getByTestId('profile-narrative')).toBeVisible();
    await expect(page.getByTestId('recruiter-executive-summary')).toBeVisible();
    await expect(page.getByTestId('recruiter-interview-guide')).toBeVisible();
    await expect(page.getByTestId('copy-summary-btn')).toBeVisible();
    await expect(page.getByText('Fortalezas clave')).toBeVisible();
    await expect(page.getByText('Debilidades observadas')).toBeVisible();
  });

  test('candidate view no muestra bloques recruiter y mantiene resumen candidato', async ({ page }) => {
    await page.goto('/?debug_stage=results&debug_access=candidate');

    await expect(page.getByText('Modo candidato')).toBeVisible();
    await expect(page.getByTestId('candidate-summary')).toBeVisible();
    await expect(page.getByTestId('recruiter-insights')).toHaveCount(0);
    await expect(page.getByTestId('candidate-score-legend')).toHaveCount(0);
    await expect(page.getByTestId('signal-quality-card')).toHaveCount(0);
    await expect(page.getByTestId('candidate-fast-read')).toHaveCount(0);
    await expect(page.getByTestId('candidate-weekly-plan')).toHaveCount(0);
    await expect(page.getByTestId('copy-summary-btn')).toBeVisible();
  });

  test('admin logout no pierde la sesion antes de persistir el cierre', async ({ page, request }) => {
    const consoleErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });

    const loginResponse = await request.post('/api/admin/recruiter-access', {
      data: {
        action: 'login',
        name: 'QA Recruiter',
        email: 'qa-recruiter@example.com',
      },
    });
    expect(loginResponse.ok()).toBeTruthy();

    const { session } = (await loginResponse.json()) as {
      session: {
        sessionId: string;
        name: string;
        email: string;
        createdAt: number;
        persistedAt?: string;
      };
    };

    await page.addInitScript((recruiterSession) => {
      window.sessionStorage.setItem('initium_recruiter_session_v1', JSON.stringify(recruiterSession));
    }, session);

    await page.goto('/es/admin');
    await expect(page.getByRole('heading', { name: 'Dashboard de recruiting' })).toBeVisible();

    await page.getByRole('button', { name: /QA Recruiter/i }).click();
    await page.getByRole('menuitem', { name: 'Cerrar sesión' }).click();

    await expect(page).toHaveURL(/\/es$/);
    expect(consoleErrors.filter((message) => message.includes('Recruiter session required'))).toHaveLength(0);
  });

  test('resultado con invitacion se refleja en el pipeline recruiter', async ({ request }) => {
    const loginResponse = await request.post('/api/admin/recruiter-access', {
      data: {
        action: 'login',
        name: 'Pipeline Recruiter',
        email: 'pipeline-recruiter@example.com',
      },
    });
    expect(loginResponse.ok()).toBeTruthy();

    const { session } = (await loginResponse.json()) as {
      session: {
        sessionId: string;
        name: string;
        email: string;
      };
    };
    const adminHeaders = {
      'x-initium-recruiter-session': session.sessionId,
      'x-initium-recruiter-email': session.email,
    };

    const jobResponse = await request.post('/api/admin/jobs', {
      headers: adminHeaders,
      data: {
        title: `QA Invite Role ${crypto.randomUUID()}`,
        department: 'Quality',
        location: 'Remote',
        owner: session.name,
      },
    });
    expect(jobResponse.ok()).toBeTruthy();
    const jobWorkspace = (await jobResponse.json()) as {
      workspace: {
        jobs: Array<{ id: string; title: string; department: string }>;
      };
    };
    const job = jobWorkspace.workspace.jobs[0];
    const inviteId = `invite-${crypto.randomUUID()}`;
    const candidateEmail = `invite-${crypto.randomUUID()}@example.com`;

    const inviteResponse = await request.post('/api/admin/invites', {
      headers: adminHeaders,
      data: {
        id: inviteId,
        candidateName: 'Invite Candidate',
        candidateEmail,
        candidatePhone: '',
        vacancyId: job.id,
        vacancy: job.title,
        department: job.department,
        recruiter: session.name,
        expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
        createdAt: new Date().toISOString(),
        status: 'sent',
      },
    });
    expect(inviteResponse.ok()).toBeTruthy();

    const assessmentId = `assessment-${crypto.randomUUID()}`;
    const assessmentResponse = await request.post('/api/assessment-results', {
      data: {
        id: assessmentId,
        inviteId,
        candidateName: 'Invite Candidate',
        candidateEmail,
        role: job.title,
        completedAt: new Date().toISOString(),
        scores: {
          personality: 78,
          memory: 82,
          leadership: 74,
          problemSolving: 81,
          ethics: 88,
          risk: 76,
          network: 79,
          strategy: 83,
        },
        metrics: {},
        totalScore: 80,
        technicalScore: 80,
        cognitiveScore: 80,
        softSkillsScore: 80,
        fitScores: {
          technicalMatch: 80,
          cognitivePerformance: 80,
          behavioralFit: 80,
          communication: 80,
          leadershipPotential: 80,
          cultureFit: 80,
        },
      },
    });
    expect(assessmentResponse.ok()).toBeTruthy();

    const workspaceResponse = await request.get('/api/admin/workspace', { headers: adminHeaders });
    expect(workspaceResponse.ok()).toBeTruthy();
    const { workspace } = (await workspaceResponse.json()) as {
      workspace: {
        candidates: Array<{ assessmentId?: string; email: string; vacancyId: string }>;
        invites: Array<{ id: string; status: string }>;
      };
    };

    expect(workspace.candidates.some((candidate) => candidate.assessmentId === assessmentId && candidate.email === candidateEmail && candidate.vacancyId === job.id)).toBeTruthy();
    expect(workspace.invites.find((invite) => invite.id === inviteId)?.status).toBe('completed');
  });
});
