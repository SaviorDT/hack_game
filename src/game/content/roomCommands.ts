import { CommandSubmissionService } from '../commands/CommandSubmissionService.ts'
import { EveryCommandRequirementChecker } from '../commands/EveryCommandRequirementChecker.ts'
import { RegisteredCommandRegistry } from '../commands/RegisteredCommandRegistry.ts'
import type { RegisteredCommand } from '../commands/CommandRegistry.ts'
import { AccCommandExecutor } from '../commands/executors/acc.ts'
import { VirtualCommandParser } from '../commands/VirtualCommandParser.ts'

export function createRoomCommandSubmissionService(): CommandSubmissionService {
  const commands: RegisteredCommand[] = [
    { name: 'acc', requirements: [], executor: new AccCommandExecutor() },
  ]

  return new CommandSubmissionService(
    new VirtualCommandParser(),
    new RegisteredCommandRegistry(commands),
    new EveryCommandRequirementChecker(),
  )
}
