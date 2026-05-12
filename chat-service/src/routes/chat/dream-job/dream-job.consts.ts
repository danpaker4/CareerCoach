/** Minimum model confidence before persisting `dreamJob` on the user document. */
export const DREAM_JOB_PERSIST_MIN_CONFIDENCE = 70;

/**
 * In FUTURE_PLANNING, when dream-job inference meets or exceeds this value, skip further
 * discovery questions after persisting (or attempting persist). Also known as the product
 * "dream job confidence threshold" for ending lightweight future exploration.
 */
export const dreamJobConfidenceThreshold = 75;
