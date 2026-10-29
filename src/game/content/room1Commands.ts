import { CommandSubmissionService } from '../commands/CommandSubmissionService.ts'
import { EveryCommandRequirementChecker } from '../commands/EveryCommandRequirementChecker.ts'
import { RegisteredCommandRegistry } from '../commands/RegisteredCommandRegistry.ts'
import type { RegisteredCommand } from '../commands/CommandRegistry.ts'
import { HelpCommandExecutor } from '../commands/executors/help.ts'
import { LsCommandExecutor } from '../commands/executors/ls.ts'
import { VirtualCommandParser } from '../commands/VirtualCommandParser.ts'

export function createRoom1CommandSubmissionService(): CommandSubmissionService {
  const commands: RegisteredCommand[] = [
    { name: 'ls', requirements: [], executor: new LsCommandExecutor() },
  ]
  const helpCommandName = 'help'

  return new CommandSubmissionService(
    new VirtualCommandParser(),
    new RegisteredCommandRegistry([
      ...commands,
      {
        name: helpCommandName,
        requirements: [],
        executor: new HelpCommandExecutor([...commands.map((command) => command.name), helpCommandName]),
      },
    ]),
    new EveryCommandRequirementChecker(),
  )
}
