import type { CommandRegistry, RegisteredCommand } from './CommandRegistry.ts'

export class RegisteredCommandRegistry implements CommandRegistry {
  private readonly commands: ReadonlyMap<string, RegisteredCommand>

  constructor(commands: readonly RegisteredCommand[]) {
    this.commands = new Map(commands.map((command) => [command.name, command] as const))

    if (this.commands.size !== commands.length) {
      throw new Error('Registered command names must be unique.')
    }
  }

  resolve(name: string): RegisteredCommand | undefined {
    return this.commands.get(name)
  }

  names(): readonly string[] {
    return [...this.commands.keys()]
  }
}
