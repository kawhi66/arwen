const path = require('path')
const pm2 = require('pm2')
const {
    chalk,
    ora,
    ErrorHandler
} = require('@arwen/arwen-utils')

// TODO: deploy command should support remote deploy such as nginx, tomcat, node ...
// TODO: for now, let's just start with local deploy based on express

// WARNING: there are many problems with forever, maybe it's better in cli,
// WARNING: but I need it work well in DaemonMode with nodejs API,
// WARNING: obviously, pm2 beats it

exports.command = ['deploy [path]']
exports.description = 'local deply'
exports.builder = yargs => {
    return yargs
        .options({
            path: {
                description: 'serve path',
                type: 'string'
            },
            port: {
                alias: 'p',
                default: '8080',
                description: 'specify port',
                type: 'string'
            },
            signal: {
                alias: 's',
                default: 'start',
                description: 'specify a signal',
                type: 'string'
            }
        })
}

exports.handler = function(argv) {
    // TODO: not just start, restart, stop, list, log(clean, tail)
    // TODO: how to stop specified process
    if (argv.signal === 'start') {
        if (argv.path) { // path must be set when start
            pm2.connect(function(err) {
                if (err) {
                    return console.error(err)
                }

                pm2.start(path.resolve(__dirname, '../lib/deploy.local.js'), {
                    name: argv.path || '',
                    env: {
                        ARWEN_DEPLOY_PATH: argv.path,
                        ARWEN_DEPLOY_PORT: argv.port
                    }
                }, function(err, apps) {
                    pm2.disconnect()

                    if (err) {
                        return console.error(err)
                    }

                    /**
                     * @description Find the matched app, must be useful for better performance
                     * @todo I wanna accurately deal with it, but still got nothing
                     */
                    if (apps.length) {
                        const one = apps.find(function(app) {
                            return app.pm2_env.ARWEN_DEPLOY_PATH === argv.path && app.pm2_env.ARWEN_DEPLOY_PORT === argv.port
                        })

                        if (one) {
                            ora(`Deploy succeed, it is running here ${chalk.green('http://localhost:' + argv.port)}.`).succeed()
                            ora(`If you need more infomation about apps running locally, try ${chalk.green('arwen deploy -s list')}.\n`).info()
                        }
                    }
                })
            })
        } else {
            ora(`For now, arwen only support local deployment. Please specify a explicit path like ${chalk.green('arwen deploy --path ./build')}.\n`).fail()
        }
    } else if (argv.signal === 'list') {
        pm2.connect(function(err) {
            if (err) {
                return console.error(err)
            }

            pm2.list(function(err, apps) {
                pm2.disconnect()

                if (err) {
                    return console.error(err)
                }

                if (apps.length) {
                    const appInfos = apps.map(app => {
                        const {
                            name,
                            pid,
                            pm2_env: {
                                ARWEN_DEPLOY_PATH,
                                ARWEN_DEPLOY_PORT,
                                status,
                                created_at
                            }
                        } = app

                        return {
                            name,
                            pid,
                            status,
                            path: ARWEN_DEPLOY_PATH,
                            port: ARWEN_DEPLOY_PORT,
                            status,
                            created_at
                        }
                    })

                    console.table(appInfos)
                } else {
                    ora(`There aren't apps deployed locally. If you need help, try ${chalk.green('arwen deploy --help')}.\n`).info()
                }
            })
        })
    } else if (argv.signal === 'stop') {
        pm2.connect(function(err) {
            if (err) {
                return console.error(err)
            }

            pm2.stop('all', function(err, proc) {
                if (err) {
                    return console.error(err)
                }

                pm2.delete('all', function(err, proc) {
                    pm2.disconnect()

                    if (err) {
                        return console.error(err)
                    }

                    ora('Stop succeed.\n').succeed()
                })
            })
        })
    } else {
        const err = new ErrorHandler('INVALID_DEPLOY_SIGNAL')
        console.error(
            '\n' +
            `   ${err.code}\n` +
            `   ${err.message}` +
            '\n'
        )
    }
}
