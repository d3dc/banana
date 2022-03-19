import { BaseCommand } from "@yarnpkg/cli"
import { Configuration, MessageName, StreamReport } from "@yarnpkg/core"
import { Command, Usage } from "clipanion"
import { Bunch } from "../../utils/Bunch"

export class InitCommand extends BaseCommand {
  static paths = [[`bunch`, `init`]]

  static usage: Usage = Command.Usage({
    category: `Bunch-related commands`,
    description: `init bunch`,
    details: `
      This command adds an empty .bunchesrc.yml.
    `,
    examples: [[`Initialize a bunch`, `$0 bunch init`]],
  })

  async execute() {
    const configuration = await Configuration.find(
      this.context.cwd,
      this.context.plugins
    )

    const report = await StreamReport.start(
      {
        configuration,
        stdout: this.context.stdout,
      },
      async (report) => {
        await Bunch.create(configuration, this.context.cwd, {
          report,
          stdin: this.context.stdin,
          stdout: this.context.stdout,
        })

        report.reportInfo(MessageName.UNNAMED, `Bunch Created!`)
      }
    )

    return report.exitCode()
  }
}
