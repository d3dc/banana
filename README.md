# Yarn Bunches

Use git to combine multiple repos into a single monorepo.

## Motivation

Organizations have a lot of repos and teams. Sometimes one monorepo isn't enough. Sometimes you need bunches.

Yarn Bunches are a solution for teams looking to stay in sync with "release channels" but also work within a singular monorepo setup.


## Installation

```
yarn plugins import [release url]
```

## Commands
```
━━━ Workspace-related commands ━━━━━━━━━━━━━━━━━

  yarn locate <Workspace Name>
    shows workspace path
    
━━━ Bunch-related commands ━━━━━━━━━━━━━━━━━━━━━

  yarn bunch add <name>
    Depend on a bunch

  yarn bunch init
    init bunch

  yarn bunch remove <name>
    remove a bunch

  yarn bunches [--json]
    list the active bunches

  yarn bunches clean [--full]
    clean the active bunches

  yarn bunches sync [--json]
    sync the active bunches
```

## Bunch Spec

A bunch name can be a `github repo`, a `git url`, or a `local path` followed by `#commit-or-branch`

## Configuration

> or how the defaults need to be decided

### Workspace

1. add a new entry to your workspace array: `".bunches/*/packages/*"`

### Assets, Other languages, Dockerfiles

1. create a package.json that is within your workspaces config
1. run yarn install
1. use the .bunches symlink in the package.json directory

## "Release Channels"

It doesn't really seem feasible to maintain individually versioned packages with this approach. 

The simplest use cases would be to target one of:

- branches that contain packages that all keep their version number in sync
- branches that contain packages that are PR'd in periodically
- branches that contain unique git "cherrypicks"
