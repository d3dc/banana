import { BaseCommand } from "@yarnpkg/cli"
import {
  Configuration,
  MessageName,
  StreamReport,
  formatUtils,
} from "@yarnpkg/core"
import { Command, Option, Usage } from "clipanion"
import { Bunch, RepoPin } from "../../utils/Bunch"

export class BunchRemoveCommand extends BaseCommand {
  static paths = [[`bunch`, `remove`]]

  static usage: Usage = Command.Usage({
    category: `Bunch-related commands`,
    description: `remove a bunch`,
    details: `
      This command deletes the specified bunch from the .bunches folder and removes it from the configuration.

      **Note:** The bunches have to be referenced by their name property, which can be obtained using the \`yarn bunches\` command. Shorthands are not allowed.
   `,
    examples: [
      [`Remove a bunch added to .bunches`, `$0 bunch remove org/team-bunch`],
    ],
  })

  name = Option.String()

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
        const repoName = this.name
        const picked = await bunch.pick({
          report,
          stdin: this.context.stdin,
          stdout: this.context.stdout,
        })

        const removed = await picked.removeRepo(repoName)

        if (!removed) {
          return report.reportInfo(MessageName.UNNAMED, `💤 Nothing to do.`)
        }

        report.reportInfo(MessageName.UNNAMED, `Updating the configuration...`)

        await Bunch.updateRc(
          bunch.cwd,
          (current: { [key: string]: unknown }) => {
            if (!Array.isArray(current.bunches)) return current

            const bunches = current.bunches.filter((bunch: RepoPin) => {
              return !removed.folderPath.endsWith(bunch.path)
            })

            if (current.bunches.length === bunches.length) return current

            return {
              ...current,
              bunches,
            }
          }
        )

        const Mark = formatUtils.mark(configuration)

        report.reportInfo(
          MessageName.UNNAMED,
          `${Mark.Check} Removed ${formatUtils.pretty(
            configuration,
            removed.folderPath,
            formatUtils.Type.PATH
          )}!`
        )
      }
    )

    return report.exitCode()
  }
}
