/** Data-access port for the health-check. Only place that talks to the driver. */
export interface HealthRepository {
  /**
   * Runs `db.command({ ping: 1 })` with a short timeout.
   * Resolves `true` if the database answered, `false` on any error/timeout.
   * Never rejects: raw driver exceptions are caught and converted here.
   */
  ping(): Promise<boolean>;
}
