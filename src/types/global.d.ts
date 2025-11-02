import type { Collection } from 'discord.js';

declare module 'discord.js' {
  interface Client {
    /** Command registry populated at startup (command name -> handler) */
    commands?: Collection<string, any>;

    /** Component handlers registry (customId -> handler) */
    componentHandlers?: Map<string, any>;

    /** Optional runtime config injected into client at startup */
    config?: {
      prefix?: string;
      [key: string]: any;
    };
  }
}

export {};
