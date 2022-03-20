# Yarn Bunches

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
