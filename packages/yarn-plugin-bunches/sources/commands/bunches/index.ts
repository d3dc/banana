import { BaseCommand } from "@yarnpkg/cli"
import {
  Configuration,
  StreamReport,
  MessageName,
  Project,
} from "@yarnpkg/core"
import { Command, Option, Usage } from "clipanion"
import { Bunch } from "../../utils/Bunch"

export class BunchListCommand extends BaseCommand {
  static paths = [[`bunches`]]

  static usage: Usage = Command.Usage({
    category: `Bunch-related commands`,
    description: `list the active bunches`,
    details: `
      This command prints the currently checked-out bunches. Will display both builtin bunches and external bunches.
    `,
    examples: [[`List the currently active bunches`, `$0 bunches`]],
  })

  json = Option.Boolean(`--json`, false, {
    description: `Format the output as an NDJSON stream`,
  })

  async execute() {
    const configuration = await Configuration.find(
      this.context.cwd,
      this.context.plugins
    )

    const { bunch, topLevelRepos } = await Bunch.find(
      configuration,
      this.context.cwd
    )

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
          `Finding bunches in ${manifestName}...`
        )

        if (!picked.repos.length) {
          report.reportInfo(MessageName.UNNAMED, `🤔 No bunches to list.`)
        } else {
          await picked.lockRepos({ sync: false })
        }

        for (const name of picked.reposByName.keys()) {
          const builtin = topLevelRepos.find((repo) => repo.path.endsWith(name))

          let label = name

          if (builtin) label += ` [root]`

          report.reportJson({ name, builtin })
          report.reportInfo(MessageName.UNNAMED, `${label}`)
        }
      }
    )

    return report.exitCode()
  }
}
