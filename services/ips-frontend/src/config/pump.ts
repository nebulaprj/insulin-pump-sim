const PUMP_ID_KEY = 'ips_pump_id'
const PUMP_ID_CHANGED_EVENT = 'pump-id-changed'
const DEFAULT_PUMP_ID = 'pump-1'

const PUMP_NAME_KEY = 'ips_pump_name'
const DEFAULT_PUMP_NAME = 'Инсулиновая Помпа'

/**
 * Получить текущий pump_id.
 *
 * Приоритет:
 * 1. URL-параметр ?pump=... (при первом визите)
 * 2. localStorage
 * 3. Дефолтный pump-1
 */
export function getPumpId(): string {
  try {
    const url = new URL(window.location.href)
    const urlPump = url.searchParams.get('pump')?.trim()
    if (urlPump) {
      localStorage.setItem(PUMP_ID_KEY, urlPump)
      return urlPump
    }
  } catch {
    // SSR или другой контекст — игнорируем
  }

  const stored = localStorage.getItem(PUMP_ID_KEY)
  if (stored && stored.trim()) {
    return stored.trim()
  }

  return DEFAULT_PUMP_ID
}

/**
 * Установить новый pump_id.
 * Сохраняет в localStorage и триггерит событие 'pump-id-changed',
 * чтобы хуки перезапустились с новым pump_id.
 */
export function setPumpId(pumpId: string): void {
  const trimmed = pumpId.trim()
  if (!trimmed) {
    throw new Error('pump_id не может быть пустым')
  }
  localStorage.setItem(PUMP_ID_KEY, trimmed)
  window.dispatchEvent(
    new CustomEvent(PUMP_ID_CHANGED_EVENT, { detail: trimmed }),
  )
}

/**
 * Сбросить pump_id к дефолтному.
 */
export function clearPumpId(): void {
  localStorage.removeItem(PUMP_ID_KEY)
  window.dispatchEvent(
    new CustomEvent(PUMP_ID_CHANGED_EVENT, { detail: DEFAULT_PUMP_ID }),
  )
}

/**
 * Подписаться на изменение pump_id.
 * Возвращает функцию отписки.
 */
export function onPumpIdChange(handler: (pumpId: string) => void): () => void {
  const listener = (e: Event) => {
    const event = e as CustomEvent<string>
    handler(event.detail)
  }
  window.addEventListener(PUMP_ID_CHANGED_EVENT, listener)
  return () => window.removeEventListener(PUMP_ID_CHANGED_EVENT, listener)
}

/**
 * Получить текущее название помпы.
 */
export function getPumpName(): string {
  const stored = localStorage.getItem(PUMP_NAME_KEY)
  if (stored && stored.trim()) {
    return stored.trim()
  }
  return DEFAULT_PUMP_NAME
}

/**
 * Сохранить новое название помпы.
 * Пустая строка возвращает к дефолтному названию.
 */
export function setPumpName(name: string): void {
  const trimmed = name.trim()
  if (trimmed) {
    localStorage.setItem(PUMP_NAME_KEY, trimmed)
  } else {
    localStorage.removeItem(PUMP_NAME_KEY)
  }
}