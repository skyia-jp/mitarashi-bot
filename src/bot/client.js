import { Client, Collection, GatewayIntentBits, Partials } from 'discord.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { importRecursively } from '../utils/fileLoader.js';
import logger from '../utils/logger.js';
import { bootstrapReminders } from '../services/reminderService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
      logger.info({ tag: this.user?.tag }, 'Bot logged in');
      await bootstrapReminders(this);
    });

    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) {
      throw new Error('DISCORD_BOT_TOKEN is not set');
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
    logger.info({ count: this.commands.size }, 'Commands loaded');
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
    logger.info('Events wired');
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
  }
}
