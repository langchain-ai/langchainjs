import { resolve } from 'node:path'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'

import type { PackageJson } from 'type-fest'

const execAsync = promisify(exec)

export interface WorkspacePackage {
    pkg: PackageJson
    path: string
}

/**
 * Find all packages in the workspace that match the package query.
 * 
 * @returns A list of package names that match the query.
 */
export async function findWorkspacePackages(rootDir: string, packageQuery?: string) {
    const result = await execAsync('yarn workspaces list --json')
    const workspaces = (await Promise.all(result.stdout.split('\n').map(async (line) => {
        try {
            const workspace = JSON.parse(line)
            if (workspace.location === '.') {
                return null
            }
            const pkg = await import(resolve(rootDir, workspace.location, 'package.json'))

            /**
             * we don't want to compile private packages
             */
            if (pkg.private) {
                return
            }

            /**
             * compile package if no query is provided or the package name matches the query
             */
            if (!packageQuery || pkg.name === packageQuery) {
                return {
                    pkg,
                    path: resolve(rootDir, workspace.location),
                }
            }
        } catch {
            /* ignore */
        }
    }))).filter(Boolean) as WorkspacePackage[]
    return workspaces
}