import { BaseCommand } from "@yarnpkg/cli"
import { Command, Option, Usage } from "clipanion"

export class LocateCommand extends BaseCommand {
  static paths = [[`locate`]]

  static usage: Usage = Command.Usage({
    category: `Workspace commands`,
    description: `shows workspace path`,
    details: `
      Print the absolute path to a specific package in the worktree.
    `,
    examples: [[`Print the path to "package"`, `$0 locate package`]],
  })

  name = Option.String({
    name: "Workspace Name",
  })

  async execute() {
    return this.cli.run([`workspace`, this.name, `exec`, `pwd`])
  }
}
