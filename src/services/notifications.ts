import { db } from '../db/index.ts';
import { businessSettings, notifications } from '../db/schema.ts';

export interface NotificationInput {
  eventType:
    | 'NEW_BOOKING'
    | 'MODIFIED'
    | 'CANCELLED'
    | 'REMINDER'
    | 'NEW_CUSTOMER'
    | 'SLOT_FREED'
    | 'DELIVERY_ERROR'
    | 'RECOVERY_CAMPAIGN';
  channel?: 'INTERNAL' | 'EMAIL' | 'SMS' | 'WHATSAPP';
  recipient: string;
  customerId?: number | null;
  appointmentId?: number | null;
  subject: string;
  body: string;
}

/**
 * Records a notification in PostgreSQL.
 * NEVER fabricates delivery confirmation: external channels stay PENDING_PROVIDER
 * unless a real external provider is explicitly configured in environment variables.
 */
export async function recordNotification(input: NotificationInput) {
  try {
    const channel = input.channel ?? 'INTERNAL';
    const [settings] = await db.select().from(businessSettings).limit(1);

    let status = 'READ';
    let provider = 'CLUB_SEGORBE_OS';
    let errorMessage: string | null = null;
    let sentAt: Date | null = null;

    if (channel === 'INTERNAL') {
      status = 'QUEUED'; // Unread in Admin Notification Center
      provider = 'ADMIN_CENTER';
    } else if (channel === 'EMAIL') {
      const configured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);
      provider = configured ? 'SMTP' : settings?.emailProvider || 'PENDING';
      if (!configured) {
        status = 'PENDING_PROVIDER';
        errorMessage = 'Proveedor de correo electrónico (SMTP) pendiente de configuración.';
      } else {
        status = 'QUEUED';
      }
    } else if (channel === 'SMS') {
      const configured = Boolean(process.env.SMS_PROVIDER_API_KEY);
      provider = configured ? 'SMS_API' : settings?.smsProvider || 'PENDING';
      if (!configured) {
        status = 'PENDING_PROVIDER';
        errorMessage = 'Proveedor SMS pendiente de configuración.';
      } else {
        status = 'QUEUED';
      }
    } else if (channel === 'WHATSAPP') {
      const configured = Boolean(process.env.WHATSAPP_BUSINESS_TOKEN);
      provider = configured ? 'META_CLOUD' : settings?.whatsappProvider || 'PENDING';
      if (!configured) {
        status = 'PENDING_PROVIDER';
        errorMessage = 'WhatsApp Business API pendiente de configuración.';
      } else {
        status = 'QUEUED';
      }
    }

    const [created] = await db
      .insert(notifications)
      .values({
        eventType: input.eventType,
        channel,
        recipient: input.recipient,
        customerId: input.customerId ?? null,
        appointmentId: input.appointmentId ?? null,
        subject: input.subject,
        body: input.body,
        status,
        provider,
        errorMessage,
        sentAt,
      })
      .returning();

    return created;
  } catch (error) {
    console.error('Failed to record notification:', error);
    throw new Error('Error registrando notificación.', { cause: error });
  }
}
