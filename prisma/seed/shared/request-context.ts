/**
 * Every seeded audit row carries a request context that names the seed that
 * wrote it, so seeded history is distinguishable from real admin activity in the
 * audit log viewer.
 */
export function seedRequestContext(name: string) {
  return {
    requestId: `seed-${name}`,
    ipHash: null,
    userAgent: `simple-dashboard-${name}-seed`,
  };
}
