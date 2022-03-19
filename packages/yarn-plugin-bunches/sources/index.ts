import { Plugin, Project, StreamReport } from "@yarnpkg/core"
import { BunchAddCommand } from "./commands/bunch/add"

import { BunchRemoveCommand } from "./commands/bunch/remove"
import { BunchListCommand } from "./commands/bunches"
import { BunchCleanCommand } from "./commands/bunches/clean"
import { BunchSyncCommand } from "./commands/bunches/sync"
import { InitCommand } from "./commands/bunch/init"

import { Bunch } from "./utils/Bunch"
import { LocateCommand } from "./commands/locate"

const plugin: Plugin = {
  hooks: {
    validateProject: async (project: Project) => {
      const { bunch } = await Bunch.find(project.configuration, project.cwd)

      if (bunch) {
        await StreamReport.start(
          {
            configuration: project.configuration,
            stdout: process.stdout,
          },
          async (report) => {
            const picked = await bunch.pick({
              report,
              stdin: process.stdin,
              stdout: process.stdout,
            })

            await picked.lockRepos({
              // we are pre-install
              sync: true,
            })
          }
        )
      }
    },
    cleanGlobalArtifacts: async (project: Project, report: StreamReport) => {
      const { bunch } = await Bunch.find(project.configuration, project.cwd)

      if (bunch) {
        await bunch.cleanUpFolder(report)
        await bunch.cleanUpProjectLinks(report)
      }
    },
  },
  commands: [
    InitCommand,
    LocateCommand,
    BunchListCommand,
    BunchSyncCommand,
    BunchCleanCommand,
    BunchAddCommand,
    BunchRemoveCommand,
  ],
}

export default plugin
