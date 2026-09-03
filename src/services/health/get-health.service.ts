import type { HealthRepository } from '../../repositories/health';

export interface HealthStatus {
  status: 'ok' | 'degraded';
  db: 'up' | 'down';
  /** Whole seconds since the process started. */
  uptime: number;
}

export type GetHealth = () => Promise<HealthStatus>;

export interface GetHealthDeps {
  healthRepository: HealthRepository;
}

/** Business rule: compose the health-check result from the DB ping and uptime. */
export const makeGetHealth =
  ({ healthRepository }: GetHealthDeps): GetHealth =>
  async () => {
    const up = await healthRepository.ping();

    return {
      status: up ? 'ok' : 'degraded',
      db: up ? 'up' : 'down',
      uptime: Math.floor(process.uptime()),
    };
  };
