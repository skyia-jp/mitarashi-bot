import nodeLogger from '@unipro-tech/node-logger/dist/cjs/index.cjs';

const { Logger: LoggerFactory, Transporter } = nodeLogger;

const serviceName = process.env.LOGGER_NAME || 'mitarashi-bot';
const runtimeEnv = process.env.NODE_ENV || 'development';
const logLevel = process.env.LOG_LEVEL;
const logFilePath = process.env.LOG_FILE_PATH;
const discordWebhookUrl = process.env.LOG_DISCORD_WEBHOOK_URL;
const discordLogLevel = process.env.LOG_DISCORD_LEVEL;

const transports = [];

if (runtimeEnv === 'production') {
  transports.push(Transporter.ConsoleTransporter({ destination: 1 }));

  if (logFilePath) {
    transports.push(Transporter.FileTransporter(logFilePath));
  }
} else {
  transports.push(
    Transporter.PinoPrettyTransporter({
      translateTime: 'SYS:standard',
      singleLine: false,
      ignore: 'pid,hostname'
    })
  );
}

if (discordWebhookUrl) {
  transports.push(
    Transporter.DiscordTransporter(discordWebhookUrl, undefined, discordLogLevel)
  );
}

const loggerFactory = new LoggerFactory(
  serviceName,
  transports,
  {},
  logLevel
);

/**
 * Get contextual logger instance with trace/request ids.
 * @param {import('@unipro-tech/node-logger').LogContext} [context]
 * @param {Record<string, any>} [extraContext]
 */
export const createLogger = (context, extraContext) =>
  loggerFactory.getLogger(context, extraContext);

export default loggerFactory.baseLogger;
