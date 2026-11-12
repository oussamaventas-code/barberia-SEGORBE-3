import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// 1. profiles — Authenticated users & RBAC roles
export const profiles = pgTable('profiles', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  fullName: text('full_name'),
  passwordHash: text('password_hash'), // scrypt hash (auth local de demostración)
  role: text('role').notNull().default('CUSTOMER'), // ADMIN | STAFF | CUSTOMER
  staffId: integer('staff_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex('profiles_email_idx').on(table.email)]);

// 2. customers — Barbería CRM clients
export const customers = pgTable(
  'customers',
  {
    id: serial('id').primaryKey(),
    publicCode: text('public_code').notNull().unique(),
    fullName: text('full_name').notNull(),
    phone: text('phone').notNull(),
    email: text('email'),
    profileUid: text('profile_uid'),
    preferredStaffId: integer('preferred_staff_id'),
    preferences: text('preferences'),
    relationshipStatus: text('relationship_status').notNull().default('NEW'), // NEW | ACTIVE | FREQUENT | AT_RISK | INACTIVE
    visitCadenceDays: integer('visit_cadence_days'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('customers_phone_idx').on(table.phone),
    index('customers_email_idx').on(table.email),
  ]
);

// 3. staff — Barbers / Professionals
export const staff = pgTable('staff', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  roleTitle: text('role_title').notNull().default('Barbero'),
  bio: text('bio'),
  specialties: text('specialties'),
  photoUrl: text('photo_url'),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 4. services — Service catalog (prices & durations strictly nullable until configured)
export const services = pgTable('services', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  priceCents: integer('price_cents'), // Null until configured by owner
  durationMinutes: integer('duration_minutes'), // Null until configured by owner
  imageUrl: text('image_url'),
  isActive: boolean('is_active').notNull().default(false),
  isConfigured: boolean('is_configured').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 5. staff_services — Many-to-many between staff and services
export const staffServices = pgTable(
  'staff_services',
  {
    id: serial('id').primaryKey(),
    staffId: integer('staff_id')
      .references(() => staff.id, { onDelete: 'cascade' })
      .notNull(),
    serviceId: integer('service_id')
      .references(() => services.id, { onDelete: 'cascade' })
      .notNull(),
    customDurationMinutes: integer('custom_duration_minutes'),
    customPriceCents: integer('custom_price_cents'),
  },
  (table) => [uniqueIndex('staff_services_unique_idx').on(table.staffId, table.serviceId)]
);

// 6. business_settings — Global barbería configuration (no invented contact/fiscal data)
export const businessSettings = pgTable('business_settings', {
  id: serial('id').primaryKey(),
  businessName: text('business_name').notNull().default('Barbería Segorbe'),
  city: text('city').notNull().default('Murcia'),
  address: text('address'),
  phone: text('phone'),
  email: text('email'),
  timezone: text('timezone').notNull().default('Europe/Madrid'),
  minLeadMinutes: integer('min_lead_minutes').notNull().default(60),
  maxAdvanceDays: integer('max_advance_days').notNull().default(30),
  cancelCutoffHours: integer('cancel_cutoff_hours').notNull().default(24),
  rescheduleCutoffHours: integer('reschedule_cutoff_hours').notNull().default(12),
  bufferMinutes: integer('buffer_minutes').notNull().default(0),
  defaultReturnCadenceDays: integer('default_return_cadence_days').notNull().default(28),
  reminderHoursBefore: integer('reminder_hours_before').notNull().default(24),
  waitlistAutoOffer: boolean('waitlist_auto_offer').notNull().default(false),
  emailProvider: text('email_provider').notNull().default('PENDING'),
  smsProvider: text('sms_provider').notNull().default('PENDING'),
  whatsappProvider: text('whatsapp_provider').notNull().default('PENDING'),
  legalEntityName: text('legal_entity_name'),
  legalTaxId: text('legal_tax_id'),
  cancellationPolicyText: text('cancellation_policy_text'),
  isSetupComplete: boolean('is_setup_complete').notNull().default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 7. working_hours — Weekly opening hours (per staff or business default when staffId is null)
export const workingHours = pgTable(
  'working_hours',
  {
    id: serial('id').primaryKey(),
    staffId: integer('staff_id').references(() => staff.id, { onDelete: 'cascade' }),
    dayOfWeek: integer('day_of_week').notNull(), // 0 = Sunday .. 6 = Saturday
    isOpen: boolean('is_open').notNull().default(false),
    openTime: text('open_time').notNull().default('09:30'), // HH:MM
    closeTime: text('close_time').notNull().default('20:00'), // HH:MM
    breakStart: text('break_start'), // HH:MM nullable
    breakEnd: text('break_end'), // HH:MM nullable
  },
  (table) => [index('working_hours_staff_day_idx').on(table.staffId, table.dayOfWeek)]
);

// 8. staff_availability — Holidays, days off, vacations, and custom date overrides
export const staffAvailability = pgTable(
  'staff_availability',
  {
    id: serial('id').primaryKey(),
    staffId: integer('staff_id').references(() => staff.id, { onDelete: 'cascade' }), // null = business holiday
    date: text('date').notNull(), // YYYY-MM-DD in Europe/Madrid
    type: text('type').notNull(), // HOLIDAY | DAY_OFF | VACATION | CUSTOM_HOURS
    startTime: text('start_time'), // HH:MM when CUSTOM_HOURS
    endTime: text('end_time'), // HH:MM when CUSTOM_HOURS
    reason: text('reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('staff_availability_date_idx').on(table.date, table.staffId)]
);

// 9. appointments — Bookings (UTC timestamps, immutable snapshot values)
export const appointments = pgTable(
  'appointments',
  {
    id: serial('id').primaryKey(),
    bookingCode: text('booking_code').notNull().unique(),
    accessToken: text('access_token').notNull().unique(),
    idempotencyKey: text('idempotency_key').unique(),
    customerId: integer('customer_id')
      .references(() => customers.id, { onDelete: 'restrict' })
      .notNull(),
    staffId: integer('staff_id')
      .references(() => staff.id, { onDelete: 'restrict' })
      .notNull(),
    startAtUtc: timestamp('start_at_utc', { withTimezone: true }).notNull(),
    endAtUtc: timestamp('end_at_utc', { withTimezone: true }).notNull(),
    bufferMinutes: integer('buffer_minutes').notNull().default(0),
    status: text('status').notNull().default('CONFIRMED'), // PENDING | CONFIRMED | COMPLETED | CANCELLED | NO_SHOW
    totalPriceCents: integer('total_price_cents'),
    totalDurationMinutes: integer('total_duration_minutes').notNull(),
    source: text('source').notNull().default('WEB'), // WEB | ADMIN | WAITLIST
    customerNotes: text('customer_notes'),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancellationReason: text('cancellation_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('appointments_staff_time_idx').on(table.staffId, table.startAtUtc, table.endAtUtc),
    index('appointments_customer_idx').on(table.customerId),
    index('appointments_status_idx').on(table.status),
  ]
);

// 10. appointment_services — Historical price/duration snapshot per appointment
export const appointmentServices = pgTable('appointment_services', {
  id: serial('id').primaryKey(),
  appointmentId: integer('appointment_id')
    .references(() => appointments.id, { onDelete: 'cascade' })
    .notNull(),
  serviceId: integer('service_id')
    .references(() => services.id, { onDelete: 'restrict' })
    .notNull(),
  serviceNameSnapshot: text('service_name_snapshot').notNull(),
  priceCentsSnapshot: integer('price_cents_snapshot'),
  durationMinutesSnapshot: integer('duration_minutes_snapshot').notNull(),
});

// 11. appointment_events — Modification & lifecycle timeline
export const appointmentEvents = pgTable(
  'appointment_events',
  {
    id: serial('id').primaryKey(),
    appointmentId: integer('appointment_id')
      .references(() => appointments.id, { onDelete: 'cascade' })
      .notNull(),
    eventType: text('event_type').notNull(), // CREATED | RESCHEDULED | STATUS_CHANGED | CANCELLED | STAFF_CHANGED
    actorRole: text('actor_role').notNull(), // CUSTOMER | ADMIN | STAFF | SYSTEM
    actorLabel: text('actor_label').notNull(),
    previousStatus: text('previous_status'),
    newStatus: text('new_status'),
    details: text('details'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('appointment_events_appt_idx').on(table.appointmentId)]
);

// 12. blocked_slots — Manual agenda blocks, breaks, vacations
export const blockedSlots = pgTable(
  'blocked_slots',
  {
    id: serial('id').primaryKey(),
    staffId: integer('staff_id').references(() => staff.id, { onDelete: 'cascade' }), // null = all staff
    startAtUtc: timestamp('start_at_utc', { withTimezone: true }).notNull(),
    endAtUtc: timestamp('end_at_utc', { withTimezone: true }).notNull(),
    blockType: text('block_type').notNull().default('BLOCKED'), // BREAK | BLOCKED | VACATION | MEETING
    title: text('title').notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('blocked_slots_staff_time_idx').on(table.staffId, table.startAtUtc, table.endAtUtc)]
);

// 13. customer_notes — Strictly private internal CRM notes (never exposed to customers)
export const customerNotes = pgTable(
  'customer_notes',
  {
    id: serial('id').primaryKey(),
    customerId: integer('customer_id')
      .references(() => customers.id, { onDelete: 'cascade' })
      .notNull(),
    authorUid: text('author_uid').notNull(),
    authorName: text('author_name').notNull(),
    noteType: text('note_type').notNull().default('NOTE'), // NOTE | INCIDENT | PREFERENCE
    content: text('content').notNull(),
    isPrivate: boolean('is_private').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('customer_notes_customer_idx').on(table.customerId)]
);

// 14. waitlist — Waitlist for freed slots (requires explicit customer acceptance)
export const waitlist = pgTable(
  'waitlist',
  {
    id: serial('id').primaryKey(),
    customerId: integer('customer_id')
      .references(() => customers.id, { onDelete: 'cascade' })
      .notNull(),
    serviceId: integer('service_id')
      .references(() => services.id, { onDelete: 'cascade' })
      .notNull(),
    staffId: integer('staff_id').references(() => staff.id, { onDelete: 'set null' }),
    preferredDate: text('preferred_date').notNull(), // YYYY-MM-DD
    timeWindowStart: text('time_window_start'), // HH:MM
    timeWindowEnd: text('time_window_end'), // HH:MM
    status: text('status').notNull().default('WAITING'), // WAITING | OFFERED | ACCEPTED | EXPIRED | CANCELLED
    offeredSlotStartUtc: timestamp('offered_slot_start_utc', { withTimezone: true }),
    offeredAt: timestamp('offered_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('waitlist_date_status_idx').on(table.preferredDate, table.status)]
);

// 15. notifications — Notification center & delivery audit (never marks unconfirmed provider sends as SENT)
export const notifications = pgTable(
  'notifications',
  {
    id: serial('id').primaryKey(),
    eventType: text('event_type').notNull(), // NEW_BOOKING | MODIFIED | CANCELLED | REMINDER | NEW_CUSTOMER | SLOT_FREED | DELIVERY_ERROR | RECOVERY_CAMPAIGN
    channel: text('channel').notNull().default('INTERNAL'), // INTERNAL | EMAIL | SMS | WHATSAPP
    recipient: text('recipient').notNull(),
    customerId: integer('customer_id').references(() => customers.id, { onDelete: 'set null' }),
    appointmentId: integer('appointment_id').references(() => appointments.id, { onDelete: 'set null' }),
    subject: text('subject').notNull(),
    body: text('body').notNull(),
    status: text('status').notNull().default('PENDING_PROVIDER'), // PENDING_PROVIDER | QUEUED | SENT | FAILED | READ
    provider: text('provider').notNull().default('NONE'),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }),
  },
  (table) => [index('notifications_created_idx').on(table.createdAt)]
);

// 16. communication_consents — RGPD / LOPDGDD separated consent ledger
export const communicationConsents = pgTable('communication_consents', {
  id: serial('id').primaryKey(),
  customerId: integer('customer_id')
    .references(() => customers.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  privacyPolicyAccepted: boolean('privacy_policy_accepted').notNull().default(false),
  privacyPolicyAcceptedAt: timestamp('privacy_policy_accepted_at', { withTimezone: true }),
  marketingOptIn: boolean('marketing_opt_in').notNull().default(false),
  marketingOptInAt: timestamp('marketing_opt_in_at', { withTimezone: true }),
  preferredChannel: text('preferred_channel').notNull().default('NONE'), // EMAIL | SMS | WHATSAPP | NONE
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 17. payments — Real payment records (revenue is strictly computed from recorded payments/completed services)
export const payments = pgTable(
  'payments',
  {
    id: serial('id').primaryKey(),
    appointmentId: integer('appointment_id')
      .references(() => appointments.id, { onDelete: 'restrict' })
      .notNull(),
    customerId: integer('customer_id')
      .references(() => customers.id, { onDelete: 'restrict' })
      .notNull(),
    amountCents: integer('amount_cents').notNull(),
    currency: text('currency').notNull().default('EUR'),
    method: text('method').notNull().default('CASH'), // CASH | CARD | BIZUM | OTHER
    status: text('status').notNull().default('PAID'), // PAID | REFUNDED | PENDING
    paidAt: timestamp('paid_at', { withTimezone: true }).defaultNow().notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('payments_appt_idx').on(table.appointmentId)]
);

// 18. audit_logs — Security & administrative audit trail
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: serial('id').primaryKey(),
    actorUid: text('actor_uid'),
    actorEmail: text('actor_email'),
    actorRole: text('actor_role').notNull(),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id'),
    details: text('details'),
    ipAddress: text('ip_address'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('audit_logs_created_idx').on(table.createdAt)]
);

// Drizzle Relations
export const customersRelations = relations(customers, ({ many, one }) => ({
  appointments: many(appointments),
  notes: many(customerNotes),
  consent: one(communicationConsents, {
    fields: [customers.id],
    references: [communicationConsents.customerId],
  }),
  payments: many(payments),
  waitlistEntries: many(waitlist),
}));

export const staffRelations = relations(staff, ({ many }) => ({
  appointments: many(appointments),
  staffServices: many(staffServices),
  workingHours: many(workingHours),
  availabilityExceptions: many(staffAvailability),
  blockedSlots: many(blockedSlots),
}));

export const servicesRelations = relations(services, ({ many }) => ({
  staffServices: many(staffServices),
  appointmentServices: many(appointmentServices),
}));

export const staffServicesRelations = relations(staffServices, ({ one }) => ({
  staff: one(staff, {
    fields: [staffServices.staffId],
    references: [staff.id],
  }),
  service: one(services, {
    fields: [staffServices.serviceId],
    references: [services.id],
  }),
}));

export const appointmentsRelations = relations(appointments, ({ one, many }) => ({
  customer: one(customers, {
    fields: [appointments.customerId],
    references: [customers.id],
  }),
  staff: one(staff, {
    fields: [appointments.staffId],
    references: [staff.id],
  }),
  services: many(appointmentServices),
  events: many(appointmentEvents),
  payments: many(payments),
}));

export const appointmentServicesRelations = relations(appointmentServices, ({ one }) => ({
  appointment: one(appointments, {
    fields: [appointmentServices.appointmentId],
    references: [appointments.id],
  }),
  service: one(services, {
    fields: [appointmentServices.serviceId],
    references: [services.id],
  }),
}));

export const appointmentEventsRelations = relations(appointmentEvents, ({ one }) => ({
  appointment: one(appointments, {
    fields: [appointmentEvents.appointmentId],
    references: [appointments.id],
  }),
}));

export const customerNotesRelations = relations(customerNotes, ({ one }) => ({
  customer: one(customers, {
    fields: [customerNotes.customerId],
    references: [customers.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  appointment: one(appointments, {
    fields: [payments.appointmentId],
    references: [appointments.id],
  }),
  customer: one(customers, {
    fields: [payments.customerId],
    references: [customers.id],
  }),
}));

export const waitlistRelations = relations(waitlist, ({ one }) => ({
  customer: one(customers, {
    fields: [waitlist.customerId],
    references: [customers.id],
  }),
  service: one(services, {
    fields: [waitlist.serviceId],
    references: [services.id],
  }),
  staff: one(staff, {
    fields: [waitlist.staffId],
    references: [staff.id],
  }),
}));
