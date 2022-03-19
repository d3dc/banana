import { BaseCommand } from "@yarnpkg/cli"
import {
  Configuration,
  formatUtils,
  MessageName,
  Project,
  StreamReport,
} from "@yarnpkg/core"
import { Command, Option, Usage } from "clipanion"
import { Bunch } from "../../utils/Bunch"

export class BunchSyncCommand extends BaseCommand {
  static paths = [[`bunches`, `sync`]]

  static usage: Usage = Command.Usage({
    category: `Bunch-related commands`,
    description: `sync the active bunches`,
    details: `
      This command syncs the currently checked-out bunches. Bunches locked to Tags and Commits will be ignored. Bunches locked to a Branch will be fast-forwarded.
    `,
    examples: [[`Sync the currently active bunches`, `$0 bunches sync`]],
  })

  json = Option.Boolean(`--json`, false, {
    description: `Format the output as an NDJSON stream`,
  })

  async execute() {
    const configuration = await Configuration.find(
      this.context.cwd,
      this.context.plugins
    )

    const Mark = formatUtils.mark(configuration)
    const { bunch } = await Bunch.find(configuration, this.context.cwd)
    const { project } = await Project.find(configuration, this.context.cwd)

    const manifestName = project.topLevelWorkspace.manifest.name.name

    const report = await StreamReport.start(
      {
        configuration,
        json: this.json,
        stdout: this.context.stdout,
      },
      async (report) => {
        const picked = await bunch.pick({
          report,
          stdin: this.context.stdin,
          stdout: this.context.stdout,
        })

        report.reportInfo(
          MessageName.UNNAMED,
          `Syncing bunches in ${manifestName}...`
        )

        if (!picked.repos.length) {
          report.reportInfo(MessageName.UNNAMED, `💤 No bunches to sync.`)
        } else {
          await picked.lockRepos()
          await picked.addAllLinks()
        }

        report.reportInfo(
          MessageName.UNNAMED,
          `${Mark.Check} Done Syncing ${manifestName}!`
        )

        report.reportInfo(
          MessageName.UNNAMED,
          `${Mark.Question} Synced ${picked.repos.length} repos!`
        )
      }
    )

    return report.exitCode()
  }
}
