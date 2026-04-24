const { upsertAssessmentResult } = require('./lib/server/admin-db');
const path = require('path');
// mock Next.js alias
require('module-alias').addAlias('@', path.join(__dirname, ''));

async function run() {
  try {
    const res = upsertAssessmentResult({
      id: 'session-foo123',
      candidateName: 'Juan R',
      candidateEmail: 'juan@initium.local',
      role: 'Frontend Dev',
      completedAt: new Date().toISOString(),
      scores: { memory: 100 },
      metrics: { memory: { errors: 0 } },
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
        cultureFit: 80
      }
    });
    console.log('Success:', res.length);
  } catch(e) {
    console.error('Error in upsertAssessmentResult:', e);
  }
}
run();
