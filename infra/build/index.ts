import { resolve, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { builtinModules } from 'node:module'

import { build } from 'tsdown'

import type { PackageJson } from 'type-fest'
import { lcSecretsPlugin } from './plugins/lc-secrets.js'

const __dirname = fileURLToPath(import.meta.url)
const execAsync = promisify(exec)

const root = resolve(__dirname, '..', '..', '..')
const external = [...builtinModules, ...builtinModules.map(m => `node:${m}`)]
const packageQuery = process.argv[2]

interface WorkspacePackage {
    pkg: PackageJson
    path: string
}

/**
 * Find all packages in the workspace that match the package query.
 * 
 * @returns A list of package names that match the query.
 */
async function findWorkspacePackages() {
    const result = await execAsync('yarn workspaces list --json')
    const workspaces = (await Promise.all(result.stdout.split('\n').map(async (line) => {
        try {
            const workspace = JSON.parse(line)
            if (workspace.location === '.') {
                return null
            }
            const pkg = await import(resolve(root, workspace.location, 'package.json'))

            /**
             * we don't want to compile private packages
             */
            if (pkg.private) {
                return
            }

            /**
             * compile package if no query is provided or the package name matches the query
             */
            if (!packageQuery || pkg.name === packageQuery || pkg.name.includes(packageQuery)) {
                return {
                    pkg,
                    path: resolve(root, workspace.location),
                }
            }
        } catch {
            /* ignore */
        }
    }))).filter(Boolean) as WorkspacePackage[]
    return workspaces
}

const packages = await findWorkspacePackages()
await Promise.all(packages.map(async ({ pkg, path }) => {
    const input = Object.entries(pkg.exports || {}).filter(([exp]) => !extname(exp)) as [string, PackageJson.ExportConditions][]
    const entry = input.map(([, { input }]) => input).filter(Boolean) as string[]
    const pkgExternals = [
        ...external,
        ...Object.keys(pkg.dependencies || {}),
        ...Object.keys(pkg.peerDependencies || {}),
    ]
    await build({
        entry,
        external: pkgExternals,
        cwd: path,
        dts: true,
        platform: 'node',
        target: 'es2020',
        outDir: './dist',
        format: ['esm', 'cjs'],
        /**
         * enable unused plugin once
         * https://github.com/unplugin/unplugin-unused/pull/47 is merged
         */
        unused: false, // { root: path },
        attw: true,
        publint: true,
        plugins: [
            lcSecretsPlugin({
                // Enable/disable based on environment
                enabled: process.env.SKIP_SECRET_SCANNING !== 'true',
                // Use lenient validation in development
                strict: process.env.NODE_ENV === 'production',
                // package path for the secret map
                packagePath: path,
            })
        ],
        inputOptions: {
            cwd: path,
        }
    })
}))  