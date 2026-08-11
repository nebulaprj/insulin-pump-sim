import { memo } from 'react'
import type { PumpMessage, MessageSeverity } from '../services/api/types'

interface MessageFeedProps {
  messages: PumpMessage[]
}

const ICONS: Record<MessageSeverity, string> = {
  info: 'ℹ️',
  warning: '⚠️',
  critical: '🚨',
}

function MessageFeedInner({ messages }: MessageFeedProps) {
  if (messages.length === 0) {
    return (
      <section className="message-feed" aria-label="Сообщения помпы">
        <div className="empty-state">Нет сообщений</div>
      </section>
    )
  }

  return (
    <section className="message-feed" aria-label="Сообщения помпы">
      <div className="message-list">
        {messages.map(msg => (
          <div key={msg.id} className="message-item">
            <span className={`message-icon message-icon-${msg.severity}`}>
              {ICONS[msg.severity]}
            </span>
            <div className="message-content">
              <span className="message-text">{msg.text}</span>
              {msg.actionText && (
                <span className="message-action">{msg.actionText}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

/**
 * React.memo: компонент не перерисовывается,
 * если messages — та же ссылка (или эквивалентный массив).
 */
export const MessageFeed = memo(MessageFeedInner)