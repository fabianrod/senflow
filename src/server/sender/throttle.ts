import { ThrottleConfig } from "@/server/common/types";

export function validateThrottleConfig(config: ThrottleConfig): string[] {
  const errors: string[] = [];

  if (config.retryCount !== 0 && config.retryCount !== 1) {
    errors.push("retryCount debe ser 0 o 1.");
  }

  if (config.mode === "fixed") {
    if (!config.fixedSeconds || config.fixedSeconds < 3) {
      errors.push("fixedSeconds debe ser mayor o igual a 3.");
    }
    return errors;
  }

  if (!config.minSeconds || config.minSeconds < 3) {
    errors.push("minSeconds debe ser mayor o igual a 3.");
  }
  if (!config.maxSeconds || config.maxSeconds < 3) {
    errors.push("maxSeconds debe ser mayor o igual a 3.");
  }
  if (
    config.minSeconds &&
    config.maxSeconds &&
    config.maxSeconds < config.minSeconds
  ) {
    errors.push("maxSeconds debe ser mayor o igual a minSeconds.");
  }

  return errors;
}
