/**
 * Конфигурация polling для получения данных с бэкенда.
 * Измените POLLING_INTERVAL_MS для регулировки частоты запросов.
 */

/** Интервал polling в миллисекундах (по умолчанию 3 секунды) */
export const POLLING_INTERVAL_MS = 3000

/** Включён ли polling (можно отключить для отладки) */
export const POLLING_ENABLED = true

/** Максимальное количество попыток при ошибке перед остановкой polling */
export const MAX_ERROR_RETRIES = 5

/** Задержка между попытками при ошибке (exponential backoff) */
export const ERROR_RETRY_DELAY_MS = 2000