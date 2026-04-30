const { weekNumber, getPhase, daysLeft } = require('../lib/messages');
const { ok, methodNotAllowed } = require('../lib/http');

// Lightweight plan response — full plan logic stays in the frontend (index.html)
// since the UI uses richer per-day metadata. This endpoint returns the
// week / phase / countdown context for any external consumers.
module.exports = async (req, res) => {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  const wn = weekNumber();
  const phase = getPhase(wn);
  return ok(res, {
    week: wn,
    daysToRace: daysLeft(),
    phase: { idx: phase.idx, name: phase.name },
    raceDate: '2027-04-18',
    raceName: 'Ironman 70.3 Brasilia'
  });
};
