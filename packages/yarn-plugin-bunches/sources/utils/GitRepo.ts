import { PortablePath, xfs } from "@yarnpkg/fslib"
import simpleGit from "simple-git"
import { Readable, Writable } from "stream"

import {
  Configuration,
  MessageName,
  StreamReport,
  structUtils,
} from "@yarnpkg/core"

const git = simpleGit()

const isRevision = (treeish) => /\d+/.test(treeish)
const isTagOrBranch = (treeish) => /\w+/.test(treeish)

type GitRepoCtx = {
  report: StreamReport
  stdin: Readable
  stdout: Writable
}

export class GitRepo {
  name: string
  treeish: string
  folderPath: PortablePath
  configuration: Configuration

  static isValidReference(treeish: string) {
    return git.revparse(["--verify", treeish])
  }

  static async fetch(url: string, path: PortablePath, ctx: GitRepoCtx) {
    ctx.report.reportInfo(MessageName.UNNAMED, `Cloning ${url}...`)
    try {
      await git.clone(url, path)
    } catch (output) {
      throw output.error
    }
  }

  constructor(
    name: string,
    folderPath: PortablePath,
    treeish: string = "default",
    configuration: Configuration
  ) {
    this.name = name
    this.treeish = treeish
    this.folderPath = folderPath
    this.configuration = configuration
  }

  async sync(ctx: GitRepoCtx) {
    const repo = await this.open(ctx)

    const repoIdent = structUtils.parseIdent(this.name)

    ctx.report.reportInfo(
      MessageName.UNNAMED,
      `Syncing ${structUtils.prettyIdent(this.configuration, repoIdent)}...`
    )

    await repo.pull()
    await repo.checkout(this.treeish)
  }

  async delete(ctx: GitRepoCtx) {
    if (xfs.existsSync(this.folderPath)) {
      const repoIdent = structUtils.parseIdent(this.name)

      ctx.report.reportInfo(
        MessageName.UNNAMED,
        `Removing ${structUtils.prettyIdent(this.configuration, repoIdent)}...`
      )
      await xfs.removePromise(this.folderPath, { recursive: true })
    }
  }

  async pnpify(ctx: GitRepoCtx) {
    // TODO: Some portion of the repo can be frozen and included
    // in a cache just like Yarn does it for NPM.
    return undefined
  }

  private async open(ctx: GitRepoCtx) {
    return simpleGit(this.folderPath)
  }
}
