import { randomUUID } from 'node:crypto';
import { Logger, Transporter } from './nodeLogger/index.ts';

const META_FIELD = 'meta';

const isPlainObject = (value: any) => Object.prototype.toString.call(value) === '[object Object]';

const normalizeValue = (value: any): any => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => normalizeValue(item)).filter((item) => item !== undefined);
  if (value instanceof Map) return normalizeValue(Object.fromEntries(value.entries()));
  if (value instanceof Set) return normalizeValue(Array.from(value.values()));
  if (isPlainObject(value)) {
    const entries = Object.entries(value).map(([k, v]) => [k, normalizeValue(v)]).filter(([, v]) => v !== undefined);
    if (!entries.length) return undefined;
    return Object.fromEntries(entries);
  }
  return value;
};

const sanitizeContext = (context: any = {}) => {
  if (!isPlainObject(context)) return {};
  return Object.fromEntries(Object.entries(context).map(([k, v]) => [k, normalizeValue(v)]).filter(([, v]) => v !== undefined));
};

const hasEntries = (obj: any) => Boolean(obj && Object.keys(obj).length);

const ensureCorrelationIds = (context: any, { includeSpanId = false } = {}) => {
  const traceId = context.trace_id ?? context.traceId ?? randomUUID();
  const requestId = context.request_id ?? context.requestId ?? randomUUID();
  const correlation: any = { ...context, trace_id: traceId, request_id: requestId };
  if (includeSpanId) correlation.span_id = context.span_id ?? context.spanId ?? randomUUID();
  return correlation;
};

const buildInteractionKind = (interaction: any) => {
  if (!interaction) return undefined;
  if (interaction.isChatInputCommand?.()) return 'chat_input';
  if (interaction.isButton?.()) return 'button';
  if (interaction.isStringSelectMenu?.()) return 'string_select';
  if (interaction.isModalSubmit?.()) return 'modal_submit';
  return interaction.type ?? undefined;
};

const safeToString = (value: any) => {
  if (value === null || value === undefined) return undefined;
  try { return String(value); } catch (_e) { return undefined; }
};

const serviceName = process.env.LOGGER_NAME || 'shiro-bot';
const runtimeEnv = process.env.NODE_ENV || 'development';
const configuredLevel = process.env.LOG_LEVEL;
const logFilePath = process.env.LOG_FILE_PATH;
const discordWebhookUrl = process.env.LOG_DISCORD_WEBHOOK_URL;
const discordLogLevel = process.env.LOG_DISCORD_LEVEL;

const targets: any[] = [];
if (runtimeEnv === 'production') {
  targets.push(Transporter.ConsoleTransporter({ destination: 1 }));
  if (logFilePath) targets.push(Transporter.FileTransporter(logFilePath));
} else {
  targets.push(Transporter.PinoPrettyTransporter({ translateTime: 'SYS:standard', singleLine: false, ignore: 'pid,hostname' }));
}

const discordTarget = Transporter.DiscordTransporter(discordWebhookUrl, {}, discordLogLevel);
if (discordTarget) targets.push(discordTarget);

const logger = Logger(serviceName, targets, configuredLevel, {
  base: { environment: runtimeEnv },
  redact: { paths: ['token', '*.token', '*.accessToken', '*.refreshToken', '*.password', 'password', 'authorization', 'authorizationHeader'], censor: '[redacted]' }
});

const buildChildBindings = (bindings: any = {}, meta: any = {}, options: any = {}) => {
  const { includeSpanId = false, metaKey = META_FIELD } = options;
  const enriched = ensureCorrelationIds(bindings, { includeSpanId });
  const sanitizedBindings = sanitizeContext(enriched);
  const sanitizedMeta = sanitizeContext(meta);
  if (metaKey && hasEntries(sanitizedMeta)) sanitizedBindings[metaKey] = sanitizedMeta;
  return sanitizedBindings;
};

export const createLogger = (context: any = {}, extraContext: any = {}, options: any = {}) => {
  const bindings = buildChildBindings(context, extraContext, options);
  return (logger as any).child(bindings);
};

export const createModuleLogger = (moduleName: string, context: any = {}, meta: any = {}, options: any = {}) => {
  const bindings = { module: moduleName, ...context };
  return createLogger(bindings, meta, options);
};

export const buildInteractionContext = (interaction: any, overrides: any = {}) => {
  if (!interaction) return sanitizeContext(overrides);
  const permissions = interaction.appPermissions?.bitfield ? safeToString(interaction.appPermissions.bitfield) : undefined;
  return sanitizeContext({ module: 'interaction', interaction_id: interaction.id, interaction_kind: buildInteractionKind(interaction), user_id: interaction.user?.id, guild_id: interaction.guildId ?? 'dm', channel_id: interaction.channelId ?? 'dm', locale: interaction.locale, permissions, ...overrides });
};

export const buildInteractionMeta = (interaction: any, overrides: any = {}) => {
  if (!interaction) return sanitizeContext(overrides);
  const baseMeta: any = { user_tag: interaction.user?.tag, user_username: interaction.user?.username, guild_name: interaction.guild?.name, channel_name: interaction.channel?.name, command: interaction.commandName ?? undefined };
  if (interaction.options?.getSubcommandGroup && interaction.options?.getSubcommand) {
    const subcommandGroup = interaction.options.getSubcommandGroup(false);
    const subcommand = interaction.options.getSubcommand(false);
    baseMeta.subcommand_group = subcommandGroup ?? undefined;
    baseMeta.subcommand = subcommand ?? undefined;
  }
  return sanitizeContext({ ...baseMeta, ...overrides });
};

export const buildInteractionLogger = (interaction: any, contextOverrides = {}, metaOverrides = {}, options = {}) => (
  createLogger(buildInteractionContext(interaction, contextOverrides), buildInteractionMeta(interaction, metaOverrides), { includeSpanId: true, ...options })
);

export default logger as any;
