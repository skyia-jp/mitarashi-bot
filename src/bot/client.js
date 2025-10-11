import { Client, Collection, GatewayIntentBits, Partials } from 'discord.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { importRecursively } from '../utils/fileLoader.js';
import { createModuleLogger } from '../utils/logger.js';
import { bootstrapReminders } from '../services/reminderService.js';
import { isGuildBlacklisted } from '../config/gban.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const botLogger = createModuleLogger('bot:client');

export default class BotClient extends Client {
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

      await bootstrapReminders(this);
    });

    const token = process.env.BOT_TOKEN;
    if (!token) {
      throw new Error('BOT_TOKEN is not set');
    }
    await this.login(token);
  }

  async loadCommands() {
    this.commands.clear();
    const commandsDir = path.join(__dirname, '..', 'commands');
    const modules = await importRecursively(commandsDir);

    for (const { module } of modules) {
      const command = module.default ?? module.command;
      if (!command?.data?.name || typeof command.execute !== 'function') {
        continue;
      }
      this.commands.set(command.data.name, command);
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
    const modules = await importRecursively(eventsDir);

    for (const { module } of modules) {
      const event = module.default ?? module.event;
      if (!event?.name || typeof event.execute !== 'function') continue;
      const once = Boolean(event.once);
      if (once) {
        this.once(event.name, (...args) => event.execute(this, ...args));
      } else {
        this.on(event.name, (...args) => event.execute(this, ...args));
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
    const modules = await importRecursively(componentsDir);

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
