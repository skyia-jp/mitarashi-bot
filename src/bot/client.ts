import { Client, Collection, GatewayIntentBits, Partials } from 'discord.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { importRecursively } from '../utils/fileLoader.js';
import { createModuleLogger } from '../utils/logger.js';
import { bootstrapReminders } from '../services/reminderService.js';
import { isGuildBlacklisted } from '../config/gban.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const botLogger = createModuleLogger('bot:client') as any;

export default class BotClient extends Client {
  commands: Collection<string, any>;
  componentHandlers: Collection<string, any>;

  constructor() {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.MessageContent
      ],
      partials: [Partials.Message, Partials.Channel, Partials.Reaction]
    });

    this.commands = new Collection();
    this.componentHandlers = new Collection();
  }

  async init() {
    await this.loadCommands();
    await this.loadEvents();
    await this.loadComponents();

    this.once('ready', async () => {
      botLogger.info(
        {
          event: 'bot.ready',
          user_tag: this.user?.tag,
          guilds: this.guilds.cache.size
        },
        'Bot logged in'
      );

      for (const guild of this.guilds.cache.values()) {
        if (isGuildBlacklisted(guild.id)) {
          await guild.leave().catch(() => null);
        }
      }

      await bootstrapReminders(this as any);
    });

    const token = process.env.BOT_TOKEN ?? process.env.DISCORD_BOT_TOKEN;
    if (!token) {
      throw new Error('BOT_TOKEN (または DISCORD_BOT_TOKEN) is not set');
    }
    await this.login(token);
  }

  async loadCommands() {
    this.commands.clear();
    const commandsDir = path.join(__dirname, '..', 'commands');
    botLogger.debug({ event: 'bot.commands.scan.start', dir: commandsDir }, 'Scanning command modules');
    const modules = await importRecursively(commandsDir) as Array<{ module: any; filePath: string }>;
    botLogger.info({ event: 'bot.commands.scan', scanned: modules.length }, 'Scanned command modules');

    for (const { module, filePath } of modules) {
      botLogger.debug({ event: 'bot.commands.module', file: filePath }, 'Found command module');
      const command = module.default ?? module.command;
      if (!command?.data?.name || typeof command.execute !== 'function') {
        botLogger.debug(
          {
            event: 'bot.commands.skipped',
            file: filePath,
            hasDataName: Boolean(command?.data?.name),
            hasExecute: typeof command?.execute === 'function'
          },
          'Skipping module while loading commands'
        );
        continue;
      }
      try {
        this.commands.set(command.data.name, command);
      } catch (err) {
        botLogger.error({ err, file: filePath, event: 'bot.commands.load_error' }, 'Failed to register command');
      }
    }
    botLogger.info(
      {
        event: 'bot.commands.loaded',
        count: this.commands.size
      },
      'Commands loaded'
    );
  }

  async loadEvents() {
    const eventsDir = path.join(__dirname, 'events');
    const modules = await importRecursively(eventsDir) as Array<{ module: any }>;

    for (const { module } of modules) {
      const event = module.default ?? module.event;
      if (!event?.name || typeof event.execute !== 'function') continue;
      const once = Boolean(event.once);
      if (once) {
        this.once(event.name, (...args: any[]) => event.execute(this, ...args));
      } else {
        this.on(event.name, (...args: any[]) => event.execute(this, ...args));
      }
    }
    botLogger.info(
      {
        event: 'bot.events.wired',
        count: modules.length
      },
      'Events wired'
    );
  }

  async loadComponents() {
    const componentsDir = path.join(__dirname, '..', 'interactions');
    const modules = await importRecursively(componentsDir) as Array<{ module: any }>;

    this.componentHandlers.clear();
    for (const { module } of modules) {
      const handler = module.default ?? module.handler;
      if (!handler?.customId || typeof handler.execute !== 'function') continue;
      this.componentHandlers.set(handler.customId, handler);
    }

    botLogger.info(
      {
        event: 'bot.components.loaded',
        count: this.componentHandlers.size
      },
      'Component handlers registered'
    );
  }
}
