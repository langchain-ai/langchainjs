#!/usr/bin/env node
import { parseArgs } from 'node:util'
import { compilePackages } from './index.js'

/**
 * CLI configuration with descriptions for auto-generated help
 */
const cliName = 'yarn workspace @langchain/infra-build start'
const cliConfig = {
    name: cliName,
    description: 'CLI program for compiling or watching packages in the repository',
    options: {
        watch: {
            type: 'boolean' as const,
            short: 'w',
            default: false,
            description: 'Watch for changes and recompile automatically'
        },
        help: {
            type: 'boolean' as const,
            short: 'h',
            default: false,
            description: 'Show this help message'
        },
        exclude: {
            type: 'string' as const,
            short: 'e',
            multiple: true,
            /**
             * WIP: currently failing
             */
            default: ['@langchain/community'],
            description: 'Exclude packages from the build (can be specified multiple times)'
        },
        noEmit: {
            type: 'boolean' as const,
            short: 'd',
            default: false,
            description: 'Skip emitting type declarations'
        },
        skipUnused: {
            type: 'boolean' as const,
            short: 's',
            default: false,
            description: 'Skip unused dependency check on packages'
        }
    },
    /**
     * only supported in later node versions
     */
    positionals: {
        name: 'package-query...',
        description: ' Optional queries to filter packages (e.g., package name patterns)\n                   Multiple queries can be provided and will be processed together'
    },
    examples: [
        { command: cliName, description: 'Compile all packages' },
        { command: `${cliName} --watch`, description: 'Watch and recompile all packages' },
        { command: `${cliName} langchain`, description: 'Compile packages matching "langchain"' },
        { command: `${cliName} langchain core`, description: 'Compile packages matching "langchain" or "core"' },
        { command: `${cliName} --no-emit`, description: 'Compile all packages without emitting type declarations' },
        { command: `${cliName} --watch core openai`, description: 'Watch packages matching "core" or "openai"' },
        { command: `${cliName} --exclude langchain-community`, description: 'Compile all packages except langchain-community' },
        { command: `${cliName} --exclude langchain-community --exclude langchain-aws`, description: 'Compile all packages except langchain-community and langchain-aws' },
        { command: `${cliName} -e community -e aws langchain`, description: 'Compile packages matching "langchain" but exclude those matching "community" or "aws"' }
    ]
}

/**
 * Generate help text from CLI configuration
 */
function generateHelp(config: typeof cliConfig): string {
    const lines: string[] = []

    lines.push(`Usage: ${config.name} [options] [${config.positionals.name}]`)
    lines.push('')
    lines.push('Options:')

    Object.entries(config.options).forEach(([key, option]) => {
        const shortFlag = option.short ? `-${option.short}, ` : '    '
        const longFlag = `--${key}`
        const padding = ' '.repeat(Math.max(0, 15 - longFlag.length))
        lines.push(`  ${shortFlag}${longFlag}${padding}${option.description}${option.default ? ` (default: ${option.default})` : ''}`)
    })

    lines.push('')
    lines.push('Arguments:')
    lines.push(`  ${config.positionals.name.padEnd(15)}${config.positionals.description}`)

    lines.push('')
    lines.push('Examples:')
    config.examples.forEach(example => {
        lines.push(`  # ${example.description}`)
        lines.push(`  ${example.command}`)
        lines.push('')
    })

    lines.push(`Copyright © ${new Date().getFullYear()} LangChain, Inc. All rights reserved.`)
    return lines.join('\n')
}

/**
 * CLI program for compiling or watching packages in the repository
 */
async function main() {
    const { values, positionals } = parseArgs({
        args: process.argv.slice(2),
        options: cliConfig.options,
        allowPositionals: true,
    })

    if (values.help) {
        console.log(generateHelp(cliConfig))
        process.exit(0)
    }

    const packageQueries = positionals
    const watch = values.watch
    const noEmit = values.noEmit
    const skipUnused = values.skipUnused
    const exclude = Array.isArray(values.exclude) ? values.exclude : (values.exclude ? [values.exclude] : [])

    try {
        if (packageQueries.length === 0) {
            console.log(`${watch ? 'Watching' : 'Compiling'} all packages...`)
            if (exclude.length > 0) {
                console.log(`Excluding: ${exclude.join(', ')}`)
            }

            await compilePackages({
                watch,
                exclude,
                noEmit,
                skipUnused,
            })
        } else if (packageQueries.length === 1) {
            console.log(`${watch ? 'Watching' : 'Compiling'} packages matching "${packageQueries[0]}"...`)
            if (exclude.length > 0) {
                console.log(`Excluding: ${exclude.join(', ')}`)
            }

            await compilePackages({
                packageQuery: packageQueries[0],
                watch,
                exclude,
                noEmit,
                skipUnused,
            })
        } else {
            console.log(`${watch ? 'Watching' : 'Compiling'} packages matching: ${packageQueries.map(q => `"${q}"`).join(', ')}...`)
            if (exclude.length > 0) {
                console.log(`Excluding: ${exclude.join(', ')}`)
            }

            // Process multiple package queries by running compilation for each query
            await Promise.all(packageQueries.map(async (packageQuery) => {
                console.log(`  Processing packages matching "${packageQuery}"...`)
                await compilePackages({
                    packageQuery,
                    watch,
                    exclude,
                    noEmit,
                    skipUnused,
                })
            }))
        }

        if (!watch) {
            console.log('✅ Compilation completed successfully!')
        }
    } catch (error) {
        console.error('❌ Compilation failed:', error)
        process.exit(1)
    }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught exception:', error)
    process.exit(1)
})

process.on('unhandledRejection', (reason) => {
    console.error('❌ Unhandled rejection:', reason)
    process.exit(1)
})

// Handle graceful shutdown for watch mode
process.on('SIGINT', () => {
    console.log('\n👋 Gracefully shutting down...')
    process.exit(0)
})

process.on('SIGTERM', () => {
    console.log('\n👋 Gracefully shutting down...')
    process.exit(0)
})

main().catch((error) => {
    console.error('❌ CLI execution failed:', error)
    process.exit(1)
})
