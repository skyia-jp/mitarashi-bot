import { randomUUID } from 'node:crypto';
import { Logger, Transporter } from './nodeLogger/index.js';

const serviceName = process.env.LOGGER_NAME || 'mitarashi-bot';
const runtimeEnv = process.env.NODE_ENV || 'development';
const configuredLevel = process.env.LOG_LEVEL;
const logFilePath = process.env.LOG_FILE_PATH;
const discordWebhookUrl = process.env.LOG_DISCORD_WEBHOOK_URL;
const discordLogLevel = process.env.LOG_DISCORD_LEVEL;

const targets = [];

if (runtimeEnv === 'production') {
  targets.push(Transporter.ConsoleTransporter({ destination: 1 }));

  if (logFilePath) {
    targets.push(Transporter.FileTransporter(logFilePath));
  }
} else {
  targets.push(
    Transporter.PinoPrettyTransporter({
      translateTime: 'SYS:standard',
      singleLine: false,
      ignore: 'pid,hostname'
    })
  );
}

const discordTarget = Transporter.DiscordTransporter(
  discordWebhookUrl,
  {},
  discordLogLevel
);

if (discordTarget) {
  targets.push(discordTarget);
}

const logger = Logger(
  serviceName,
  targets,
  configuredLevel,
  {
    base: {
      environment: runtimeEnv
    }
  }
);

export const createLogger = (context = {}, extraContext) => {
  const traceId = context.trace_id ?? randomUUID();
  const requestId = context.request_id ?? randomUUID();
  const childContext = { ...context, trace_id: traceId, request_id: requestId };

  if (extraContext && Object.keys(extraContext).length > 0) {
    childContext.context = extraContext;
  }

  return logger.child(childContext);
};

export default logger;
