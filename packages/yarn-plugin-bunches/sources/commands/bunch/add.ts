import { BaseCommand } from "@yarnpkg/cli"
import {
  Configuration,
  MessageName,
  ReportError,
  StreamReport,
  formatUtils,
  structUtils,
} from "@yarnpkg/core"
import { npath, ppath } from "@yarnpkg/fslib"
import { Option } from "clipanion"
import { URL } from "url"
import { githubUrl } from "../../utils/Github"
import { GitRepo } from "../../utils/GitRepo"
import { Bunch } from "../../utils/Bunch"

export class BunchAddCommand extends BaseCommand {
  static paths = [[`bunch`, `add`]]

  static usage = BaseCommand.Usage({
    category: `Bunch-related commands`,
    description: `Depend on a bunch`,
    details: `
      This command clones the specified bunch from its remote location and updates the configuration to reference it in workspace packages.

      A valid Bunch path is:
      - The github repo name
      - a source control path
      - A file path

      Bunches can be annotated with:

      - Branch
      - Tag
      - Commit

      Bunches cannot be downloaded from the npm registry.
    `,
    examples: [
      [
        `Clone and activate a bunch by URL`,
        `$0 bunch add git@github.com:org/team-bunch.git`,
      ],
      [
        `Clone and activate "org" bunch (shorthand)`,
        `$0 bunch add org/team-bunch`,
      ],
      [
        `Clone and activate the "experimental" branch`,
        `$0 bunch add org/team-bunch#experimental`,
      ],
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
        const picked = await bunch.pick({
          report,
          stdin: this.context.stdin,
          stdout: this.context.stdout,
        })

        await picked.lockRepos() //lock versions so conflicts happen

        let repoSpec: string

        if (this.name.match(/^\.{0,2}[\\/]/) || npath.isAbsolute(this.name)) {
          const candidatePath = ppath.resolve(
            this.context.cwd,
            npath.toPortablePath(this.name)
          )

          report.reportInfo(
            MessageName.UNNAMED,
            `Reading ${formatUtils.pretty(
              configuration,
              candidatePath,
              formatUtils.Type.PATH
            )}`
          )

          repoSpec = ppath.relative(bunch.cwd, candidatePath)
        } else {
          if (this.name.match(/^https?:/)) {
            try {
              new URL(this.name)
            } catch {
              throw new ReportError(
                MessageName.INVALID_PLUGIN_REFERENCE,
                `Bunch specifier "${this.name}" is neither a bunch name nor a valid url`
              )
            }

            repoSpec = this.name
          } else {
            const locator = structUtils.parseLocator(this.name)
            if (
              locator.reference !== `unknown` &&
              !GitRepo.isValidReference(locator.reference)
            ) {
              throw new ReportError(
                MessageName.UNNAMED,
                `Bunches only accept git idioms as references. Semver ranges are not supported.`
              )
            }

            if (locator.reference === `unknown`) {
              locator.reference = `default`
            }

            const identStr = structUtils.stringifyIdent(locator)

            repoSpec = githubUrl({ repoName: identStr })
          }
        }

        report.reportInfo(
          MessageName.UNNAMED,
          `Adding ${formatUtils.pretty(
            configuration,
            repoSpec,
            formatUtils.Type.PATH
          )}...`
        )

        const repoPath = await picked.addRepo(repoSpec, true)

        const repoMeta = {
          spec: repoSpec,
          path: repoPath,
        }

        report.reportInfo(MessageName.UNNAMED, `Updating the configuration...`)

        await Bunch.updateRc(bunch.cwd, (current: any) => {
          const bunches = []
          let hasBeenReplaced = false

          for (const entry of current.bunches || []) {
            const rcProvidedPath =
              typeof entry === `string` ? entry : entry.path

            if (rcProvidedPath !== repoPath) {
              bunches.push(entry)
            } else {
              bunches.push(repoMeta)
              hasBeenReplaced = true
            }
          }

          if (!hasBeenReplaced) bunches.push(repoMeta)

          return { ...current, bunches }
        })

        const Mark = formatUtils.mark(configuration)

        report.reportInfo(
          MessageName.UNNAMED,
          `${Mark.Check} Added ${formatUtils.pretty(
            configuration,
            repoPath,
            formatUtils.Type.PATH
          )}!`
        )
      }
    )

    return report.exitCode()
  }
}
