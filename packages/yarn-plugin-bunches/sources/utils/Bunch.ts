import {
  Configuration,
  formatUtils,
  MessageName,
  Project,
  StreamReport,
  structUtils,
} from "@yarnpkg/core"
import { Filename, PortablePath, ppath, xfs } from "@yarnpkg/fslib"
import { parseSyml, stringifySyml } from "@yarnpkg/parsers"
import { Readable, Writable } from "stream"
import { UsageError } from "clipanion"

import { GitRepo } from "./GitRepo"
import { parseSpec } from "./Github"

export const ENVIRONMENT_PREFIX = `bunches`
export const DEFAULT_RC_FILENAME = `.bunchesrc.yml` as Filename
export const DEFAULT_BUCKET_FOLDER = `.bunches` as Filename

export type RepoPin = { path: PortablePath; spec: string }

export type BunchCtx = {
  report: StreamReport
  stdin: Readable
  stdout: Writable
}

export class Bunch {
  static async create(
    configuration: Configuration,
    cwd: PortablePath,
    ctx: BunchCtx
  ) {
    const rcFilename = getRcFilename()
    const rcPath = ppath.join(cwd, rcFilename as PortablePath)

    if (xfs.existsSync(rcPath)) {
      throw new Error("bunches configuration already exists!")
    }

    ctx.report.reportInfo(
      MessageName.UNNAMED,
      `Creating bunches manifest at: ${formatUtils.pretty(
        configuration,
        rcPath,
        formatUtils.Type.PATH
      )}...`
    )
    await xfs.writeFilePromise(rcPath, "")

    const { repos } = await findProjectRepos(cwd)

    return new Bunch(cwd, repos, configuration)
  }

  static async find(configuration: Configuration, startingCwd: PortablePath) {
    const { cwd, repos } = await findProjectRepos(startingCwd)

    const bunch = new Bunch(cwd, repos, configuration)

    return { bunch, topLevelRepos: repos, cwd }
  }

  static async updateRc(
    cwd: PortablePath,
    patch:
      | { [key: string]: ((current: unknown) => unknown) | {} | undefined }
      | ((current: { [key: string]: unknown }) => { [key: string]: unknown })
  ) {
    const rcFilename = getRcFilename()
    const configurationPath = ppath.join(cwd, rcFilename as PortablePath)

    const current = xfs.existsSync(configurationPath)
      ? (parseSyml(await xfs.readFilePromise(configurationPath, `utf8`)) as any)
      : {}

    let patched = false
    let replacement: { [key: string]: unknown }

    if (typeof patch === `function`) {
      try {
        replacement = patch(current)
      } catch {
        replacement = patch({})
      }

      if (replacement === current) {
        return
      }
    } else {
      replacement = current

      for (const key of Object.keys(patch)) {
        const currentValue = current[key]
        const patchField = patch[key]

        let nextValue: unknown
        if (typeof patchField === `function`) {
          try {
            nextValue = patchField(currentValue)
          } catch {
            nextValue = patchField(undefined)
          }
        } else {
          nextValue = patchField
        }

        if (currentValue === nextValue) continue

        replacement[key] = nextValue
        patched = true
      }

      if (!patched) {
        return
      }
    }

    await xfs.changeFilePromise(configurationPath, stringifySyml(replacement), {
      automaticNewlines: true,
    })
  }

  cwd: PortablePath
  repos: (string | RepoPin)[]
  configuration: Configuration

  private constructor(
    cwd: PortablePath,
    repos: (string | RepoPin)[],
    configuration: Configuration
  ) {
    this.cwd = cwd
    this.configuration = configuration
    this.repos = repos
  }

  async pick(ctx: BunchCtx) {
    await this.touchBunch(ctx.report)

    const picked = new PickedBunch(this, ctx)

    for (const repo of this.repos) {
      await picked.addRepo(repo)
    }

    return picked
  }

  private async touchBunch(report: StreamReport) {
    const rootBunchPath = ppath.resolve(this.cwd, DEFAULT_BUCKET_FOLDER)

    if (!xfs.existsSync(rootBunchPath)) {
      report.reportInfo(
        MessageName.UNNAMED,
        `Creating the root bunch folder at: ${formatUtils.pretty(
          this.configuration,
          rootBunchPath,
          formatUtils.Type.PATH
        )}...`
      )
      await xfs.mkdirPromise(rootBunchPath)
    }

    return rootBunchPath
  }

  async cleanUpFolder(report: StreamReport) {
    const rootBunchPath = ppath.resolve(this.cwd, DEFAULT_BUCKET_FOLDER)
    report.reportInfo(
      MessageName.UNNAMED,
      `Removing ${formatUtils.pretty(
        this.configuration,
        rootBunchPath,
        formatUtils.Type.PATH
      )}...`
    )
    await xfs.removePromise(rootBunchPath, { recursive: true })
  }

  async cleanUpProjectLinks(report: StreamReport) {
    const { project } = await Project.find(this.configuration, this.cwd)

    for (const child of project.topLevelWorkspace.getRecursiveWorkspaceChildren()) {
      const portalPath = ppath.resolve(child.cwd, DEFAULT_BUCKET_FOLDER)

      report.reportInfo(
        MessageName.UNNAMED,
        `Unlinking ${formatUtils.pretty(
          this.configuration,
          child.relativeCwd,
          formatUtils.Type.PATH
        )}...`
      )

      try {
        await xfs.unlinkPromise(portalPath)
      } catch {
        continue
      }
    }
  }
}

class PickedBunch {
  bunch: Bunch
  ctx: BunchCtx
  repos: GitRepo[]
  reposByName: Map<string, GitRepo>

  constructor(bunch: Bunch, ctx: BunchCtx) {
    this.bunch = bunch
    this.ctx = ctx
    this.repos = []
    this.reposByName = new Map()
  }

  async syncRepos() {
    for (const repo of this.repos) {
      this.ctx.report.reportJson({ name: repo.name, reference: repo.treeish })
      await repo.sync(this.ctx)
    }
  }

  async addRepo(repoMeta: string | RepoPin, overwrite?: boolean) {
    let repoName: string
    let repoPath: string
    let repoTreeish: string
    let folderPath: PortablePath

    if (typeof repoMeta === "string") {
      const parsed = parseSpec(repoMeta)

      repoName = parsed.name
      repoPath = parsed.path
      repoTreeish = parsed.treeish
      folderPath = ppath.join(DEFAULT_BUCKET_FOLDER, repoName as PortablePath)
    } else {
      const parsed = parseSpec(repoMeta.spec)

      repoName = parsed.name
      repoPath = repoMeta.spec
      repoTreeish = parsed.treeish
      folderPath = repoMeta.path
    }

    if (overwrite || !this.reposByName.has(repoName)) {
      const absolutePath = ppath.join(this.bunch.cwd, folderPath)

      if (overwrite && xfs.existsSync(absolutePath)) {
        await xfs.removePromise(absolutePath, { recursive: true })
      }

      if (!xfs.existsSync(absolutePath)) {
        const repoIdent = structUtils.parseIdent(repoName)
        if (overwrite) {
          this.ctx.report.reportInfo(
            MessageName.UNNAMED,
            `Replacing repository on disk: ${structUtils.prettyIdent(
              this.bunch.configuration,
              repoIdent
            )}`
          )
        } else {
          this.ctx.report.reportInfo(
            MessageName.UNNAMED,
            `Repository not found on disk: ${structUtils.prettyIdent(
              this.bunch.configuration,
              repoIdent
            )}`
          )
        }
        await GitRepo.fetch(repoPath, absolutePath, this.ctx)
        await this.addLink(absolutePath)
      }

      const repo = new GitRepo(
        repoName,
        absolutePath,
        repoTreeish,
        this.bunch.configuration
      )

      this.reposByName.set(repoName, repo)
      this.repos.push(repo)
    } else {
      const fixed = this.reposByName[repoName]

      if (fixed.treeish !== repoTreeish) {
        throw new Error(
          invalidBunchConfigurationMessage(repoName, fixed.treeish, repoTreeish)
        )
      }
    }

    return folderPath
  }

  async removeRepo(repoName: string) {
    const repo = this.reposByName.get(repoName)

    if (!repo) {
      const Mark = formatUtils.mark(this.bunch.configuration)
      const repoIdent = structUtils.parseIdent(repoName)
      this.ctx.report.reportError(
        MessageName.INVALID_PLUGIN_REFERENCE,
        `${
          Mark.Cross
        } The current configuration doesn't reference ${structUtils.prettyIdent(
          this.bunch.configuration,
          repoIdent
        )}`
      )
      return repo
    }

    await repo.delete(this.ctx)

    return repo
  }

  async lockRepos({ sync = true } = {}) {
    this.ctx.report.reportInfo(
      MessageName.UNNAMED,
      `Locking bunch repos in ${formatUtils.pretty(
        this.bunch.configuration,
        this.bunch.cwd,
        formatUtils.Type.PATH
      )}...`
    )

    for (const repo of this.repos) {
      if (sync) {
        await repo.sync(this.ctx)
      }

      const { repos: childRepos } = await findProjectRepos(repo.folderPath)

      for (const repo of childRepos) {
        await this.addRepo(repo)
      }
    }
  }

  async addLink(repoDir: PortablePath) {
    if (!xfs.existsSync(repoDir)) {
      const relativePath = ppath.relative(this.bunch.cwd, repoDir)
      const rootBunchPath = ppath.resolve(this.bunch.cwd, DEFAULT_BUCKET_FOLDER)
      const portalPath = ppath.resolve(repoDir, DEFAULT_BUCKET_FOLDER)

      this.ctx.report.reportInfo(
        MessageName.UNNAMED,
        `Linking ${formatUtils.pretty(
          this.bunch.configuration,
          relativePath,
          formatUtils.Type.PATH
        )}...`
      )
      await xfs.symlinkPromise(rootBunchPath, portalPath, "dir")
    }
  }

  async addAllLinks() {
    const { project } = await Project.find(
      this.bunch.configuration,
      this.bunch.cwd
    )

    for (const child of project.topLevelWorkspace.getRecursiveWorkspaceChildren()) {
      this.addLink(child.cwd)
    }
  }
}

function getRcFilename() {
  const rcKey = `${ENVIRONMENT_PREFIX}rc_filename`

  for (const [key, value] of Object.entries(process.env))
    if (key.toLowerCase() === rcKey && typeof value === `string`)
      return value as Filename

  return DEFAULT_RC_FILENAME as Filename
}

type RcFileRecord = { path: PortablePath; cwd: PortablePath; data: any }

async function findRcFiles(startingCwd: PortablePath) {
  const rcFilename = getRcFilename()
  const rcFiles = [] as RcFileRecord[]

  let nextCwd = startingCwd
  let currentCwd = null

  while (nextCwd !== currentCwd && !nextCwd.endsWith(".bunches")) {
    currentCwd = nextCwd

    const rcPath = ppath.join(currentCwd, rcFilename as PortablePath)

    if (xfs.existsSync(rcPath)) {
      const content = await xfs.readFilePromise(rcPath, `utf8`)

      let data
      try {
        data = parseSyml(content) as any
      } catch (error) {
        let tip = ``

        if (content.match(/^\s+(?!-)[^:]+\s+\S+/m))
          tip = ` (in particular, make sure you list the colons after each key name)`

        throw new UsageError(
          `Parse error when loading ${rcPath}; please check it's proper Yaml${tip}`
        )
      }

      rcFiles.push({ path: rcPath, cwd: currentCwd, data })
    }

    nextCwd = ppath.dirname(currentCwd)
  }

  return rcFiles
}

export async function findProjectRepos(startingCwd: PortablePath) {
  const rcFiles = await findRcFiles(startingCwd)
  const repos = [] as RepoPin[]

  let bunchCwd: PortablePath

  for (const { data, cwd } of rcFiles) {
    if (!bunchCwd) {
      bunchCwd = cwd
    }
    if (data.bunches) {
      for (const repoMeta of data.bunches) {
        repos.push(repoMeta)
      }
    }
  }

  if (!bunchCwd) {
    bunchCwd = startingCwd
  }

  return { cwd: bunchCwd, repos }
}

function invalidBunchConfigurationMessage(
  name: string,
  have: string,
  want: string,
  source: string = "the project root"
) {
  return `Bunch "${name}" is already instantiated at "${have}", while ${source} requested "${want}".`
}
