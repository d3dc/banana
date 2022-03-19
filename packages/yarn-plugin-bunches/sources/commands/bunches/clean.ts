import { BaseCommand } from "@yarnpkg/cli"
import { Configuration, StreamReport, MessageName } from "@yarnpkg/core"
import { Command, Option, Usage } from "clipanion"
import { Bunch } from "../../utils/Bunch"

export class BunchCleanCommand extends BaseCommand {
  static paths = [[`bunches`, `clean`]]

  static usage: Usage = Command.Usage({
    category: `Bunch-related commands`,
    description: `clean the active bunches`,
    details: `
      This command removes symlinks from all active bunches.
    `,
    examples: [[`Clean the currently active bunches`, `$0 bunches clean`]],
  })

  full = Option.Boolean(`--full`, false, {
    description: `Remove the .bunches folder entirely`,
  })

  async execute() {
    const configuration = await Configuration.find(
      this.context.cwd,
      this.context.plugins
    )

    const { bunch } = await Bunch.find(configuration, this.context.cwd)

    const report = await StreamReport.start(
      {
        configuration,
        stdout: this.context.stdout,
      },
      async (report) => {
        await bunch.cleanUpProjectLinks(report)

        if (this.full) {
          await bunch.cleanUpFolder(report)
        }
      }
    )

    return report.exitCode()
  }
}
