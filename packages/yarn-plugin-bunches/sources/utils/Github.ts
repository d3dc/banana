import { Filename, PortablePath } from "@yarnpkg/fslib"

export const githubUrl = ({ repoName }: { repoName: string }) =>
  `https://github.com/${repoName}` as PortablePath

const urlSpec = /^((?:https?:\/\/)?(?:.*?\/)*(.+?))(?:\#(.+))?$/

export function parseSpec(pathStr: string) {
  let match = pathStr.match(urlSpec)

  if (!match) throw new Error(invalidSpecMessage(pathStr))

  const [, path, name, treeish = "default"] = match

  return {
    path,
    name,
    treeish,
  }
}

function invalidSpecMessage(url: string): string {
  return `Input cannot be parsed as a valid repo spec ('${url}').`
}
